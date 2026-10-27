"use strict";

// Import direct depuis un profil public Letterboxd (flux RSS, ~50 dernières entrées, sans clé)
// ou Trakt (API publique, nécessite un « Client ID » gratuit saisi dans l'appli).
// Chaque ligne revient avec la fiche TMDB et une note en étoiles (1 à 5) si elle existe.

const store = require("./db");
const { encrypt, decrypt } = require("./cryptoBox");
const tmdb = require("./tmdb");

const LB = (process.env.LETTERBOXD_BASE || "https://letterboxd.com").replace(/\/$/, "");
const TRAKT = (process.env.TRAKT_BASE || "https://api.trakt.tv").replace(/\/$/, "");

const clean = (u) => String(u || "").trim().replace(/^@/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
const stars = (v) => Math.min(5, Math.max(1, Math.round(v)));
const tag = (xml, name) => { const m = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">").exec(xml); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null; };

async function pmap(arr, n, fn) {
  const out = new Array(arr.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => {
    while (i < arr.length) { const j = i++; try { out[j] = await fn(arr[j]); } catch (e) { out[j] = null; } }
  }));
  return out;
}

async function lean(id, region) {
  const d = await tmdb.details(id, region);
  delete d.recs;
  return d;
}

async function letterboxd(user, region) {
  user = clean(user);
  if (!user) { const e = new Error("Indiquez le nom d'utilisateur Letterboxd."); e.status = 400; throw e; }
  const res = await fetch(LB + "/" + user + "/rss/", { headers: { "User-Agent": "Watch-It" }, signal: AbortSignal.timeout(20000) });
  if (res.status === 404) { const e = new Error("Profil Letterboxd introuvable (il doit être public)."); e.status = 404; throw e; }
  if (!res.ok) { const e = new Error("Letterboxd ne répond pas (" + res.status + ")."); e.status = 502; throw e; }
  const xml = await res.text();
  const items = (xml.match(/<item>[\s\S]*?<\/item>/g) || []).map((b) => ({
    tmdb: tag(b, "tmdb:movieId"), title: tag(b, "letterboxd:filmTitle"), year: tag(b, "letterboxd:filmYear"),
    rating: tag(b, "letterboxd:memberRating"),
  })).filter((x) => x.tmdb || x.title);
  const seen = new Set();
  const uniq = items.filter((x) => { const k = x.tmdb || x.title + x.year; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 60);
  const rows = await pmap(uniq, 5, async (x) => {
    let item = null;
    if (x.tmdb) item = await lean("movie:" + x.tmdb, region);
    else { const hit = (await tmdb.search(x.title, x.year ? Number(x.year) : null))[0]; item = hit || null; }
    return { raw: x.title + (x.year ? " (" + x.year + ")" : ""), item, r: x.rating ? stars(Number(x.rating)) : 0 };
  });
  return rows.filter(Boolean);
}

function traktClient() { const e = store.getSecret("trakt_client"); return e ? decrypt(e) : null; }
function traktStatus() { const k = traktClient(); return { hasKey: !!k, last4: k ? k.slice(-4) : null }; }
function saveTrakt(k) { store.setSecret("trakt_client", encrypt(k.trim())); }
function clearTrakt() { store.deleteSecret("trakt_client"); }

async function traktGet(path, client) {
  const res = await fetch(TRAKT + path, { headers: { "trakt-api-version": "2", "trakt-api-key": client, "User-Agent": "Watch-It" }, signal: AbortSignal.timeout(20000) });
  if (res.status === 401 || res.status === 403) { const e = new Error("Trakt refuse ce Client ID, ou le profil n'est pas public."); e.status = 400; throw e; }
  if (res.status === 404) { const e = new Error("Profil Trakt introuvable."); e.status = 404; throw e; }
  if (!res.ok) { const e = new Error("Trakt ne répond pas (" + res.status + ")."); e.status = 502; throw e; }
  return res.json();
}

async function trakt(user, region) {
  const client = traktClient();
  if (!client) { const e = new Error("Enregistrez d'abord votre Client ID Trakt."); e.status = 400; throw e; }
  user = clean(user);
  if (!user) { const e = new Error("Indiquez le nom d'utilisateur Trakt."); e.status = 400; throw e; }
  const [movies, shows, wm, ws] = await Promise.all([
    traktGet("/users/" + user + "/ratings/movies", client),
    traktGet("/users/" + user + "/ratings/shows", client),
    traktGet("/users/" + user + "/watched/movies", client).catch(() => []),
    traktGet("/users/" + user + "/watched/shows", client).catch(() => []),
  ]);
  const rows = [];
  const add = (type, ids, r) => { const t = ids && ids.tmdb; if (t) rows.push({ id: type + ":" + t, r }); };
  movies.forEach((x) => add("movie", x.movie && x.movie.ids, stars(x.rating / 2)));
  shows.forEach((x) => add("tv", x.show && x.show.ids, stars(x.rating / 2)));
  const rated = new Set(rows.map((r) => r.id));
  wm.forEach((x) => { const t = x.movie && x.movie.ids && x.movie.ids.tmdb; if (t && !rated.has("movie:" + t)) rows.push({ id: "movie:" + t, r: 0 }); });
  ws.forEach((x) => { const t = x.show && x.show.ids && x.show.ids.tmdb; if (t && !rated.has("tv:" + t)) rows.push({ id: "tv:" + t, r: 0 }); });
  const out = await pmap(rows.slice(0, 120), 5, async (x) => ({ item: await lean(x.id, region), r: x.r }));
  return out.filter((x) => x && x.item).map((x) => ({ raw: x.item.t, item: x.item, r: x.r }));
}

module.exports = { letterboxd, trakt, traktStatus, saveTrakt, clearTrakt };
