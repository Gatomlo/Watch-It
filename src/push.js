"use strict";

// Notifications (Web Push) : prévient quand un titre de la liste « À voir » quitte une plateforme du
// foyer. Le serveur vérifie la disponibilité toutes les 6 h. Clés VAPID générées une fois puis gardées
// en base (clé privée chiffrée). Sur iPhone, l'appli doit être installée sur l'écran d'accueil.

const webpush = require("web-push");
const store = require("./db");
const { encrypt, decrypt } = require("./cryptoBox");
const tmdb = require("./tmdb");

store.db.exec("CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, data TEXT NOT NULL, profile TEXT NOT NULL DEFAULT 'M', created_at TEXT NOT NULL DEFAULT (datetime('now')))");

try { store.db.exec("ALTER TABLE push_subs ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}'"); } catch (e) { /* colonne déjà présente */ }
const KINDS = ["added", "release", "gone", "match", "tonight"]; // préférences par appareil, toutes actives par défaut

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
function prefsOf(endpoint) {
  const row = store.db.prepare("SELECT prefs FROM push_subs WHERE endpoint = ?").get(String(endpoint || ""));
  let p = {}; try { p = JSON.parse(row && row.prefs) || {}; } catch (e) {}
  const out = Object.fromEntries(KINDS.map((k) => [k, p[k] !== false]));
  out.hour = Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 23 ? p.hour : 8; // heure de la notification de sortie
  return out;
}
function setPrefs(endpoint, prefs) {
  const cur = prefsOf(endpoint), next = {};
  KINDS.forEach((k) => { next[k] = prefs && typeof prefs[k] === "boolean" ? prefs[k] : cur[k]; });
  next.hour = prefs && Number.isInteger(prefs.hour) && prefs.hour >= 0 && prefs.hour <= 23 ? prefs.hour : cur.hour;
  store.db.prepare("UPDATE push_subs SET prefs = ? WHERE endpoint = ?").run(JSON.stringify(next), String(endpoint || ""));
  return next;
}
const unsubscribe = (endpoint) => store.db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(String(endpoint || ""));
const count = () => store.db.prepare("SELECT COUNT(*) AS n FROM push_subs").get().n;
const isSubscribed = (endpoint) => !!store.db.prepare("SELECT 1 FROM push_subs WHERE endpoint = ?").get(String(endpoint || ""));

// Remplaçable en test.
let sender = async (sub, payload) => {
  const v = vapid();
  await webpush.sendNotification(sub, JSON.stringify(payload), {
    vapidDetails: { subject: "https://github.com/Gatomlo/Watch-It", publicKey: v.pub, privateKey: v.priv }, TTL: 86400,
  });
};
function setSender(fn) { sender = fn; }

// kind : type de notification (préférence de l'appareil) ; profile : « M » ou « E » pour ne viser que lui.
async function send(payload, onlyEndpoint, kind, profile) {
  let rows = onlyEndpoint
    ? store.db.prepare("SELECT endpoint, data, prefs FROM push_subs WHERE endpoint = ?").all(onlyEndpoint)
    : store.db.prepare("SELECT endpoint, data, prefs, profile FROM push_subs").all();
  if (profile) rows = rows.filter((r) => r.profile === profile);
  if (kind) rows = rows.filter((r) => { try { return JSON.parse(r.prefs || "{}")[kind] !== false; } catch (e) { return true; } });
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
    if (d.date && d.date > today && e.d !== d.date) { e.d = d.date; delete e.rn; changed = true; } // date de sortie à venir (ou décalée)
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
    await send({ title: "Watch-It", body, tag: "maiwatch-gone", url: "./" }, null, "gone");
  }
  return { checked: todo.length, gone: gone.length };
}

// --- Nouveaux ajouts de l'autre profil : regroupés 45 s pour ne pas notifier titre par titre ---
const other = (u) => (u === "M" ? "E" : "M");
const wantsIt = (e, u) => (e.w ? !!e.w[u] : e.by === u);
const queue = { M: [], E: [] };
let flushTimer = null;
function notifyAdded(before, after) {
  const known = new Set(((before && before.list) || []).map((e) => e.id));
  const fresh = (after.list || []).filter((e) => e && e.status === "todo" && !known.has(e.id) && (e.by === "M" || e.by === "E"));
  if (!fresh.length) return;
  fresh.forEach((e) => { const t = other(e.by); if (!wantsIt(e, t)) queue[t].push({ by: e.by, t: e.t, id: e.id }); });
  if (!flushTimer && (queue.M.length || queue.E.length)) { flushTimer = setTimeout(flushAdded, 45 * 1000); flushTimer.unref(); }
}
async function flushAdded() {
  flushTimer = null;
  const names = (store.getState().settings || {}).profiles || {};
  for (const target of ["M", "E"]) {
    const items = queue[target].splice(0);
    if (!items.length) continue;
    const who = names[items[0].by] || (items[0].by === "M" ? "Moi" : "Elle");
    const one = items.length === 1;
    const body = one ? who + " a ajouté « " + items[0].t + " ». Voulez-vous le voir aussi ?" : who + " a ajouté " + items.length + " titres : " + items.slice(0, 3).map((i) => "« " + i.t + " »").join(", ") + (items.length > 3 ? "…" : "") + ". Voulez-vous les voir aussi ?";
    // Boutons sous la notification (Android / ordinateur ; iPhone n'affiche que le texte) : le service worker appelle /api/react.
    const actions = one ? [{ action: "want", title: "Moi aussi" }, { action: "no", title: "Pas pour moi" }] : [{ action: "open", title: "Voir la liste" }];
    await send({ title: "Watch-It", body, tag: one ? "maiwatch-added-" + items[0].id : "maiwatch-added", url: "./?view=news", u: target, id: one ? items[0].id : null, actions }, null, "added", target).catch(() => {});
  }
}

// Réaction « Moi aussi » / « Pas pour moi » depuis une notification (ou tout client) : modifie l'état partagé.
function react(id, u, want) {
  if ((u !== "M" && u !== "E") || typeof id !== "string") { const e = new Error("Requête invalide."); e.status = 400; throw e; }
  for (let i = 0; i < 4; i++) {
    const state = store.getState(), version = store.getStateVersion();
    const e = state.list.find((x) => x.id === id);
    if (!e) { const err = new Error("Titre introuvable."); err.status = 404; throw err; }
    if (want) {
      e.w = e.w || { [e.by]: true }; e.w[u] = true;
      if (e.no) delete e.no[u];
    } else { e.no = e.no || {}; e.no[u] = true; }
    if (store.saveState(state, version) != null) return { ok: true, title: e.t };
  }
  const err = new Error("Réessayez."); err.status = 409; throw err;
}

// --- Match à deux et « Proposer ce soir » : l'autre profil est prévenu quand l'état change ---
const nameOf = (u) => ((store.getState().settings || {}).profiles || {})[u] || (u === "M" ? "Moi" : "Elle");
const TYPES = { film: "de films", serie: "de séries" };
function matchBody(m) { return nameOf(m.by) + " vous invite à un Match à deux" + (TYPES[m.ty] ? " " + TYPES[m.ty] : "") + ". Chacun balaye la même sélection !"; }
function notifyMatch(before, after) {
  const m = after.match;
  if (!m || (m.by !== "M" && m.by !== "E") || (before && before.match && before.match.id === m.id)) return;
  send({ title: "Watch-It · Match à deux", body: matchBody(m), tag: "maiwatch-match", url: "./?view=match" }, null, "match", other(m.by)).catch(() => {});
}
// Relance manuelle (bouton « Inviter » de la partie en cours).
async function inviteMatch(from) {
  const m = store.getState().match;
  if ((from !== "M" && from !== "E") || !m) { const e = new Error("Aucune partie en cours."); e.status = 404; throw e; }
  return send({ title: "Watch-It · Match à deux", body: matchBody(Object.assign({}, m, { by: from })), tag: "maiwatch-match", url: "./?view=match" }, null, "match", other(from));
}
function notifyTonight(before, after) {
  const t = after.tonight;
  if (!t || t.st !== "pending" || (t.by !== "M" && t.by !== "E") || (before && before.tonight && before.tonight.pid === t.pid)) return;
  send({ title: "Watch-It · Ce soir ?", body: nameOf(t.by) + " propose « " + t.t + " » ce soir.", tag: "maiwatch-tonight", url: "./?view=tonight", u: other(t.by), pid: t.pid,
    actions: [{ action: "tok", title: "Partant" }, { action: "tno", title: "Pas ce soir" }] }, null, "tonight", other(t.by)).catch(() => {});
}
// Réponse (depuis la notification ou l'appli) : met à jour l'état puis prévient celui qui proposait.
function answerTonight(pid, u, ok) {
  if ((u !== "M" && u !== "E") || typeof pid !== "string") { const e = new Error("Requête invalide."); e.status = 400; throw e; }
  for (let i = 0; i < 4; i++) {
    const state = store.getState(), version = store.getStateVersion();
    const t = state.tonight;
    if (!t || t.pid !== pid || t.by === u) { const err = new Error("Proposition introuvable."); err.status = 404; throw err; }
    if (t.st !== "pending") return { ok: true, title: t.t, st: t.st };
    t.st = ok ? "ok" : "no";
    if (store.saveState(state, version) != null) {
      send({ title: "Watch-It · Ce soir ?", body: nameOf(u) + (ok ? " est partant(e) pour « " : " n'est pas partant(e) pour « ") + t.t + " ».", tag: "maiwatch-tonight-ans", url: "./?view=tonight" }, null, "tonight", t.by).catch(() => {});
      return { ok: true, title: t.t, st: t.st };
    }
  }
  const err = new Error("Réessayez."); err.status = 409; throw err;
}

// --- Date de sortie atteinte (titres ajoutés avant leur sortie : e.d) ---
const TZ = process.env.NOTIF_TZ || "Europe/Brussels";
function localNow() {
  const f = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t) => f.find((p) => p.type === t).value;
  return { date: g("year") + "-" + g("month") + "-" + g("day"), hour: Number(g("hour")) };
}
// Chaque appareil choisit son heure (8 h par défaut) ; e.rn = { <empreinte appareil>: true } évite les doublons.
// Seules les sorties d'hier ou d'aujourd'hui sont notifiées (un nouvel appareil ne reçoit pas tout l'historique).
const crypto = require("crypto");
const devKey = (endpoint) => crypto.createHash("sha1").update(endpoint).digest("hex").slice(0, 8);
async function releaseCheck(now) {
  now = now || localNow();
  const state = store.getState(), version = store.getStateVersion();
  const yesterday = new Date(Date.parse(now.date + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  const due = state.list.filter((e) => e.status === "todo" && e.d && e.d <= now.date && e.d >= yesterday && e.rn !== true);
  if (!due.length) return { sent: 0 };
  const rows = store.db.prepare("SELECT endpoint, data, prefs, profile FROM push_subs").all();
  const jobs = [];
  for (const r of rows) {
    let p = {}; try { p = JSON.parse(r.prefs || "{}"); } catch (e) {}
    const hour = Number.isInteger(p.hour) ? p.hour : 8, k = devKey(r.endpoint);
    if (p.release === false || now.hour < hour) continue;
    const mine = due.filter((e) => wantsIt(e, r.profile) && !(e.rn && e.rn[k]));
    if (!mine.length) continue;
    mine.forEach((e) => { e.rn = e.rn || {}; e.rn[k] = true; });
    jobs.push({ r, mine });
  }
  if (!jobs.length) return { sent: 0 };
  if (store.saveState(state, version) == null) return { sent: 0, skipped: true };
  let sent = 0;
  for (const { r, mine } of jobs) {
    const body = mine.length === 1 ? "« " + mine[0].t + " » sort aujourd'hui." : mine.length + " titres de votre liste sortent : " + mine.slice(0, 3).map((e) => "« " + e.t + " »").join(", ") + (mine.length > 3 ? "…" : "") + ".";
    try { await sender(JSON.parse(r.data), { title: "Watch-It · Sortie", body, tag: "maiwatch-release", url: "./" }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) unsubscribe(r.endpoint); }
  }
  return { sent, due: due.length };
}

let timer = null;
let relTimer = null;
function start() {
  if (timer) return;
  setTimeout(() => releaseCheck().catch(() => {}), 2 * 60 * 1000).unref();
  relTimer = setInterval(() => releaseCheck().catch(() => {}), 3600 * 1000);
  relTimer.unref();
  setTimeout(() => watch().catch(() => {}), 60 * 1000).unref();
  timer = setInterval(() => watch().catch(() => {}), 6 * 3600 * 1000);
  timer.unref();
}

module.exports = { publicKey, subscribe, unsubscribe, count, isSubscribed, prefsOf, setPrefs, send, setSender, watch, start, notifyAdded, flushAdded, releaseCheck, react, notifyMatch, inviteMatch, notifyTonight, answerTonight };
