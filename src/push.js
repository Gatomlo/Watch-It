"use strict";

// Notifications (Web Push) : prévient quand un titre de la liste « À voir » quitte une plateforme du
// foyer. Le serveur vérifie la disponibilité toutes les 6 h. Clés VAPID générées une fois puis gardées
// en base (clé privée chiffrée). Sur iPhone, l'appli doit être installée sur l'écran d'accueil.

const webpush = require("web-push");
const store = require("./db");
const { encrypt, decrypt } = require("./cryptoBox");
const tmdb = require("./tmdb");

store.db.exec("CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, data TEXT NOT NULL, profile TEXT NOT NULL DEFAULT 'M', created_at TEXT NOT NULL DEFAULT (datetime('now')))");

function vapid() {
  let pub = store.getSecret("vapid_pub"), priv = (store.getSecret("vapid_priv") && decrypt(store.getSecret("vapid_priv"))) || null;
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    pub = k.publicKey; priv = k.privateKey;
    store.setSecret("vapid_pub", pub); store.setSecret("vapid_priv", encrypt(priv));
  }
  return { pub, priv };
}
const publicKey = () => vapid().pub;

function subscribe(sub, profile) {
  if (!sub || typeof sub.endpoint !== "string" || !sub.keys) { const e = new Error("Abonnement invalide."); e.status = 400; throw e; }
  store.db.prepare("INSERT INTO push_subs (endpoint, data, profile) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET data = excluded.data, profile = excluded.profile")
    .run(sub.endpoint, JSON.stringify(sub), profile === "E" ? "E" : "M");
}
const unsubscribe = (endpoint) => store.db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(String(endpoint || ""));
const count = () => store.db.prepare("SELECT COUNT(*) AS n FROM push_subs").get().n;
const isSubscribed = (endpoint) => !!store.db.prepare("SELECT 1 FROM push_subs WHERE endpoint = ?").get(String(endpoint || ""));

// Remplaçable en test.
let sender = async (sub, payload) => {
  const v = vapid();
  await webpush.sendNotification(sub, JSON.stringify(payload), {
    vapidDetails: { subject: "https://github.com/Gatomlo/mAIwatch", publicKey: v.pub, privateKey: v.priv }, TTL: 86400,
  });
};
function setSender(fn) { sender = fn; }

async function send(payload, onlyEndpoint) {
  const rows = onlyEndpoint
    ? store.db.prepare("SELECT endpoint, data FROM push_subs WHERE endpoint = ?").all(onlyEndpoint)
    : store.db.prepare("SELECT endpoint, data FROM push_subs").all();
  let sent = 0;
  for (const r of rows) {
    try { await sender(JSON.parse(r.data), payload); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) unsubscribe(r.endpoint); }
  }
  return sent;
}

// Compare la disponibilité actuelle (TMDB, sans cache) à celle gardée dans la liste ; met à jour
// la liste (e.av, e.alert) comme le ferait l'appli, puis notifie les départs.
async function watch() {
  const state = store.getState();
  const version = store.getStateVersion();
  const plats = (state.settings && state.settings.platforms) || [];
  const region = (state.settings && state.settings.region) || "BE";
  if (!tmdb.configured() || !plats.length) return { checked: 0, gone: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const todo = state.list.filter((e) => e.status === "todo" && tmdb.parseKey(e.id));
  const gone = [];
  let changed = false;
  for (const e of todo) {
    let d;
    try { d = await tmdb.details(e.id, region, { bust: true }); } catch (err) { continue; }
    const now = d.av.f, prev = e.av && e.av.f;
    if (!prev) { e.av = { f: now.slice(), at: today }; changed = true; continue; }
    if (JSON.stringify(prev.slice().sort()) === JSON.stringify(now.slice().sort())) continue;
    const lost = prev.filter((p) => now.indexOf(p) < 0 && plats.indexOf(p) >= 0);
    const fresh = now.filter((p) => prev.indexOf(p) < 0 && plats.indexOf(p) >= 0);
    if (lost.length) { e.alert = { k: "gone", p: lost[0], at: today }; gone.push({ e, p: lost[0] }); }
    else if (fresh.length) e.alert = { k: "new", p: fresh[0], at: today };
    e.av = { f: now.slice(), at: today };
    changed = true;
  }
  // Écriture seulement si personne n'a modifié l'état entre-temps (sinon, au prochain passage).
  if (changed && store.saveState(state, version) == null) return { checked: todo.length, gone: 0, skipped: true };
  if (gone.length) {
    const names = {};
    try {
      const list = await tmdb.providers(region);
      list.forEach((p) => { names[p.id] = p.name; });
    } catch (err) {}
    const nm = (id) => names[id] || "une de vos plateformes";
    const body = gone.length === 1 ? "« " + gone[0].e.t + " » n'est plus sur " + nm(gone[0].p) + "." : gone.length + " titres de votre liste quittent vos plateformes : " + gone.slice(0, 3).map((g) => "« " + g.e.t + " »").join(", ") + ".";
    await send({ title: "mAIwatch", body, tag: "maiwatch-gone", url: "./" });
  }
  return { checked: todo.length, gone: gone.length };
}

let timer = null;
function start() {
  if (timer) return;
  setTimeout(() => watch().catch(() => {}), 60 * 1000).unref();
  timer = setInterval(() => watch().catch(() => {}), 6 * 3600 * 1000);
  timer.unref();
}

module.exports = { publicKey, subscribe, unsubscribe, count, isSubscribed, send, setSender, watch, start };
