"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");

const keys = require("./keys");
const db = require("./db");
const SqliteSessionStore = require("./sessionStore");
const tmdb = require("./tmdb");
const ai = require("./ai");
const engine = require("./engine");
const importers = require("./importers");
const push = require("./push");

const app = express();
const PORT = process.env.PORT || 3100;

// Aucun .env requis : les clés internes sont générées dans data/keys.json (voir keys.js).
const sessionSecret = keys.session;

// Premier démarrage : aucun compte. Un code d'installation est affiché dans la console du serveur
// (pm2 logs) ; il faut le saisir pour créer le compte, afin que personne d'autre ne le fasse avant vous.
let setupCode = null;
function ensureSetupCode() {
  if (db.userCount() > 0) { setupCode = null; return; }
  if (!setupCode) {
    const h = crypto.randomBytes(6).toString("hex").toUpperCase();
    setupCode = h.slice(0, 4) + "-" + h.slice(4, 8) + "-" + h.slice(8, 12);
    console.warn(
      "\n[mAIwatch] Aucun compte. Ouvrez le site et créez-le avec ce code d'installation :\n\n      " + setupCode + "\n"
    );
  }
}
ensureSetupCode();

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
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true" ? true : process.env.COOKIE_SECURE === "false" ? false : "auto", maxAge: SESSION_MAX_AGE },
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

// Création du compte du foyer, possible une seule fois (tant qu'aucun compte n'existe).
const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessayez dans quelques minutes." },
});
app.post("/api/setup", setupLimiter, (req, res) => {
  if (db.userCount() > 0) return res.status(409).json({ error: "Un compte existe déjà. Connectez-vous." });
  const { username, password, code } = req.body || {};
  if (typeof username !== "string" || !username.trim() || username.trim().length > 40) {
    return res.status(400).json({ error: "Choisissez un identifiant (40 caractères au plus)." });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
  }
  ensureSetupCode();
  const given = Buffer.from(String(code || "").trim().toUpperCase());
  const want = Buffer.from(setupCode || "");
  if (!setupCode || given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return res.status(403).json({ error: "Code d'installation incorrect. Il est affiché dans la console du serveur (pm2 logs maiwatch)." });
  }
  const id = db.createFirstUser(username.trim(), bcrypt.hashSync(password, 12));
  if (id == null) return res.status(409).json({ error: "Un compte existe déjà. Connectez-vous." });
  setupCode = null;
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Erreur serveur." });
    req.session.userId = id;
    req.session.cookie.maxAge = REMEMBER_MAX_AGE;
    req.session.save((e2) => (e2 ? res.status(500).json({ error: "Erreur serveur." }) : res.json({ ok: true, username: username.trim() })));
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("maiwatch_sid");
    res.json({ ok: true });
  });
});

app.get("/api/session", (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ authenticated: false, setup: db.userCount() === 0 });
  const user = db.getFirstUser();
  res.json({ authenticated: true, username: user ? user.username : null });
});

app.post("/api/account/username", requireAuth, (req, res) => {
  const username = String((req.body && req.body.username) || "").trim();
  if (!username || username.length > 40) return res.status(400).json({ error: "Identifiant invalide (1 à 40 caractères)." });
  const existing = db.getUser(username);
  if (existing && existing.id !== req.session.userId) return res.status(409).json({ error: "Cet identifiant est déjà utilisé." });
  db.updateUsername(req.session.userId, username);
  res.json({ ok: true, username });
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
  res.json({ tmdb: tmdb.configured(), tmdbKey: tmdb.status(), region: db.getState().settings.region || "BE", ai: ai.status() });
});

// Clé TMDB : saisie dans l'appli, vérifiée auprès de TMDB puis chiffrée en base.
app.put("/api/tmdb-key", requireAuth, wrap(async (req, res) => {
  const key = String((req.body && req.body.key) || "").trim();
  if (key.length < 20 || key.length > 600 || /\s/.test(key)) return res.status(400).json({ error: "Collez la clé TMDB en entier (clé API v3 ou jeton de lecture v4)." });
  const r = await tmdb.check(key);
  if (!r.ok) return res.status(400).json({ error: r.error });
  tmdb.saveKey(key);
  res.json({ tmdb: tmdb.configured(), tmdbKey: tmdb.status() });
}));
app.delete("/api/tmdb-key", requireAuth, (req, res) => {
  tmdb.clearKey();
  res.json({ tmdb: tmdb.configured(), tmdbKey: tmdb.status() });
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
    const d = list[i];
    if (!d) return;
    out[id] = { f: d.av.f, r: d.av.r, b: d.av.b, trailer: !!d.trailer };
    if (d.seasonsInfo) { out[id].se = d.seasonsInfo; out[id].last = d.lastEp; out[id].next = d.nextEp; out[id].ended = d.ended; }
  });
  res.json(out);
}));

app.get("/api/suggestions", requireAuth, wrap(async (req, res) => {
  const tab = ["me", "other", "both"].includes(req.query.tab) ? req.query.tab : "me";
  const me = req.query.me === "E" ? "E" : "M";
  res.json(await engine.suggestions(db.getState(), tab, me));
}));

app.get("/api/upcoming", requireAuth, wrap(async (req, res) => {
  res.json(await engine.upcoming(db.getState(), req.query.me === "E" ? "E" : "M"));
}));

app.post("/api/envies", requireAuth, wrap(async (req, res) => {
  const text = String((req.body && req.body.text) || "").trim().slice(0, 500);
  if (text.length < 3) return res.status(400).json({ error: "Décrivez votre envie en quelques mots." });
  const me = req.body.me === "E" ? "E" : "M";
  const mins = Number(req.body.minutes);
  res.json(await engine.envies(db.getState(), text, me, Number.isFinite(mins) && mins >= 15 && mins <= 720 ? Math.round(mins) : null));
}));

// Import : chaque ligne est rapprochée du meilleur résultat TMDB ; l'année entre parenthèses affine.
app.post("/api/import", requireAuth, wrap(async (req, res) => {
  const lines = Array.isArray(req.body && req.body.lines) ? req.body.lines.map((l) => String(l).trim()).filter(Boolean).slice(0, 200) : [];
  const hints = Array.isArray(req.body.hints) ? req.body.hints : [];
  const out = await engine.pmap(lines, 4, async (raw) => {
    const m = /^(.*?)[\s(]+((?:19|20)\d{2})\)?$/.exec(raw);
    const title = m ? m[1].trim() : raw;
    const hits = await tmdb.search(title, m ? Number(m[2]) : null);
    const want = hints[lines.indexOf(raw)];
    const pick = (want && hits.find((h) => h.ty === want)) || hits[0] || null;
    return { raw, item: pick };
  });
  res.json(out.map((o, i) => o || { raw: lines[i], item: null }));
}));

// --- Import direct (Letterboxd public, Trakt) ---
app.post("/api/import/letterboxd", requireAuth, wrap(async (req, res) => {
  res.json(await importers.letterboxd(req.body && req.body.user, engine.region(db.getState())));
}));
app.post("/api/import/trakt", requireAuth, wrap(async (req, res) => {
  res.json(await importers.trakt(req.body && req.body.user, engine.region(db.getState())));
}));
app.get("/api/trakt-key", requireAuth, (req, res) => res.json(importers.traktStatus()));
app.put("/api/trakt-key", requireAuth, (req, res) => {
  const key = String((req.body && req.body.key) || "").trim();
  if (key.length < 16 || key.length > 200 || /\s/.test(key)) return res.status(400).json({ error: "Collez le Client ID Trakt en entier." });
  importers.saveTrakt(key);
  res.json(importers.traktStatus());
});
app.delete("/api/trakt-key", requireAuth, (req, res) => { importers.clearTrakt(); res.json(importers.traktStatus()); });

// --- Notifications ---
app.get("/api/push/key", requireAuth, (req, res) => res.json({ publicKey: push.publicKey() }));
app.post("/api/push/subscribe", requireAuth, wrap(async (req, res) => {
  push.subscribe(req.body && req.body.sub, req.body && req.body.profile);
  res.json({ ok: true });
}));
app.post("/api/push/unsubscribe", requireAuth, (req, res) => { push.unsubscribe(req.body && req.body.endpoint); res.json({ ok: true }); });
app.post("/api/push/status", requireAuth, (req, res) => res.json({ subscribed: push.isSubscribed(req.body && req.body.endpoint) }));
app.post("/api/push/test", requireAuth, wrap(async (req, res) => {
  const n = await push.send({ title: "mAIwatch", body: "Les notifications fonctionnent sur cet appareil.", tag: "maiwatch-test", url: "./" }, req.body && req.body.endpoint);
  res.json({ sent: n });
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
    push.start();
  });
}
module.exports = app;
