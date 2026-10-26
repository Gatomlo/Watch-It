"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");

const db = require("./db");
const SqliteSessionStore = require("./sessionStore");
const tmdb = require("./tmdb");
const ai = require("./ai");
const engine = require("./engine");

const app = express();
const PORT = process.env.PORT || 3100;
const IS_PROD = process.env.NODE_ENV === "production";

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret === "change-this-to-a-long-random-string") {
  if (IS_PROD) {
    throw new Error("[mAIwatch] SESSION_SECRET manquant ou laissé par défaut dans .env.");
  }
  sessionSecret = crypto.randomBytes(48).toString("hex");
  console.warn("[mAIwatch] SESSION_SECRET absent : valeur temporaire générée (sessions perdues au redémarrage).");
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;

app.use(
  session({
    store: new SqliteSessionStore(),
    secret: sessionSecret,
    name: "maiwatch_sid",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", maxAge: SESSION_MAX_AGE },
  })
);

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: "not_authenticated" });
}

// Enveloppe les routes async : une erreur TMDB ou IA devient une réponse JSON lisible.
const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    const status = e.status || 500;
    if (status >= 500 && status !== 503) console.warn("[mAIwatch]", req.method, req.path, e.message);
    res.status(status).json({ error: e.message === "tmdb_not_configured" ? "tmdb_not_configured" : (e.message || "Erreur serveur.") });
  });

// --- Auth ---

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessaie dans quelques minutes." },
});

app.post("/api/login", loginLimiter, (req, res) => {
  const { username, password, remember } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Identifiant et mot de passe requis." });
  }
  const user = db.getUser(username.trim());
  if (!user) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
  bcrypt.compare(password, user.password_hash, (err, ok) => {
    if (err || !ok) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    req.session.regenerate((regenErr) => {
      if (regenErr) return res.status(500).json({ error: "Erreur serveur." });
      req.session.userId = user.id;
      req.session.cookie.maxAge = remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ error: "Erreur serveur." });
        res.json({ ok: true, username: user.username });
      });
    });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("maiwatch_sid");
    res.json({ ok: true });
  });
});

app.get("/api/session", (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ authenticated: false });
  const user = db.getFirstUser();
  res.json({ authenticated: true, username: user ? user.username : null });
});

app.post("/api/account/password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
  }
  const user = db.getFirstUser();
  if (!user || user.id !== req.session.userId) return res.status(401).json({ error: "not_authenticated" });
  bcrypt.compare(currentPassword, user.password_hash, (err, ok) => {
    if (err || !ok) return res.status(401).json({ error: "Mot de passe actuel incorrect." });
    db.updatePasswordHash(user.id, bcrypt.hashSync(newPassword, 12));
    res.json({ ok: true });
  });
});

// --- État partagé (liste, notes, profils, plateformes), versionné comme dans Fée Lezcomptes ---

app.get("/api/state", requireAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-State-Version", String(db.getStateVersion()));
  res.json(db.getState());
});

app.put("/api/state", requireAuth, (req, res) => {
  const state = req.body;
  if (!state || typeof state !== "object" || Array.isArray(state) || !Array.isArray(state.list)) {
    return res.status(400).json({ error: "Format invalide." });
  }
  const baseHeader = req.get("X-Base-Version");
  const base = baseHeader != null && /^\d+$/.test(baseHeader) ? Number(baseHeader) : null;
  const version = db.saveState(state, base);
  if (version == null) {
    res.set("X-State-Version", String(db.getStateVersion()));
    return res.status(409).json({ error: "conflict", state: db.getState() });
  }
  res.set("X-State-Version", String(version));
  res.json({ ok: true, version });
});

// --- Configuration, TMDB ---

app.get("/api/config", requireAuth, (req, res) => {
  res.json({ tmdb: tmdb.configured(), region: db.getState().settings.region || "BE", ai: ai.status() });
});

app.get("/api/providers", requireAuth, wrap(async (req, res) => {
  const region = String(req.query.region || db.getState().settings.region || "BE").toUpperCase().slice(0, 2);
  res.json(await tmdb.providers(region));
}));

app.get("/api/search", requireAuth, wrap(async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 120);
  if (q.length < 2) return res.json([]);
  const y = /^(\d{4})$/.test(String(req.query.year || "")) ? Number(req.query.year) : null;
  res.json(await tmdb.search(q, y));
}));

app.get("/api/title/:id", requireAuth, wrap(async (req, res) => {
  const d = await tmdb.details(req.params.id, engine.region(db.getState()));
  delete d.recs;
  res.json(d);
}));

// Disponibilité (plateformes de la région) d'une série de titres : { id: { f, r, b } }.
app.post("/api/availability", requireAuth, wrap(async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.filter((x) => tmdb.parseKey(x)).slice(0, 80) : [];
  const region = engine.region(db.getState());
  const out = {};
  const list = await engine.pmap(ids, 6, (id) => tmdb.details(id, region));
  ids.forEach((id, i) => {
    if (list[i]) out[id] = { f: list[i].av.f, r: list[i].av.r, b: list[i].av.b, trailer: !!list[i].trailer };
  });
  res.json(out);
}));

app.get("/api/suggestions", requireAuth, wrap(async (req, res) => {
  const tab = ["me", "other", "both"].includes(req.query.tab) ? req.query.tab : "me";
  const me = req.query.me === "E" ? "E" : "M";
  res.json(await engine.suggestions(db.getState(), tab, me));
}));

app.post("/api/envies", requireAuth, wrap(async (req, res) => {
  const text = String((req.body && req.body.text) || "").trim().slice(0, 500);
  if (text.length < 3) return res.status(400).json({ error: "Décrivez votre envie en quelques mots." });
  const me = req.body.me === "E" ? "E" : "M";
  res.json(await engine.envies(db.getState(), text, me));
}));

// Import : chaque ligne est rapprochée du meilleur résultat TMDB ; l'année entre parenthèses affine.
app.post("/api/import", requireAuth, wrap(async (req, res) => {
  const lines = Array.isArray(req.body && req.body.lines) ? req.body.lines.map((l) => String(l).trim()).filter(Boolean).slice(0, 200) : [];
  const out = await engine.pmap(lines, 4, async (raw) => {
    const m = /^(.*?)[\s(]+((?:19|20)\d{2})\)?$/.exec(raw);
    const title = m ? m[1].trim() : raw;
    const hits = await tmdb.search(title, m ? Number(m[2]) : null);
    return { raw, item: hits[0] || null };
  });
  res.json(out.map((o, i) => o || { raw: lines[i], item: null }));
}));

// --- Assistant d'envies : clé API (jamais renvoyée au navigateur, seulement ses 4 derniers caractères) ---

app.get("/api/ai", requireAuth, (req, res) => res.json(ai.status()));
app.put("/api/ai", requireAuth, (req, res) => {
  const { provider, key } = req.body || {};
  ai.save(String(provider), typeof key === "string" ? key : "");
  res.json(ai.status());
});
app.post("/api/ai/test", requireAuth, wrap(async (req, res) => {
  const r = await ai.test();
  res.json(Object.assign({}, r, { status: ai.status() }));
}));
app.delete("/api/ai", requireAuth, (req, res) => {
  ai.clear();
  res.json(ai.status());
});

// --- Front-end ---

app.use(express.static(path.join(__dirname, "..", "public")));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("[mAIwatch] Serveur démarré sur http://localhost:" + PORT);
    if (!tmdb.configured()) console.warn("[mAIwatch] TMDB_API_KEY / TMDB_READ_TOKEN absent : films et séries indisponibles.");
  });
}
module.exports = app;
