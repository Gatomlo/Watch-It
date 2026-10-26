"use strict";

// Accès à l'API TMDB (https://developer.themoviedb.org). Les réponses sont gardées dans
// la table `cache` (SQLite) pour ménager l'API et accélérer l'appli.
// Données « où regarder » : fournies par TMDB d'après JustWatch (mention obligatoire dans l'appli).

const store = require("./db");

const BASE = (process.env.TMDB_BASE || "https://api.themoviedb.org/3").replace(/\/$/, "");
const H = 60 * 60 * 1000;
const LANG = "fr-FR";

function configured() {
  return !!(process.env.TMDB_API_KEY || process.env.TMDB_READ_TOKEN);
}

async function call(path, params, ttl) {
  if (!configured()) {
    const e = new Error("tmdb_not_configured");
    e.status = 503;
    throw e;
  }
  const qs = new URLSearchParams(params || {});
  const cacheKey = path + "?" + [...qs.entries()].sort().map((p) => p.join("=")).join("&");
  if (ttl) {
    const hit = store.cacheGet(cacheKey);
    if (hit) return hit;
  }
  const headers = { Accept: "application/json" };
  if (process.env.TMDB_READ_TOKEN) headers.Authorization = "Bearer " + process.env.TMDB_READ_TOKEN;
  else qs.set("api_key", process.env.TMDB_API_KEY);
  const res = await fetch(BASE + path + "?" + qs.toString(), { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const e = new Error("tmdb_" + res.status);
    e.status = res.status === 404 ? 404 : 502;
    throw e;
  }
  const data = await res.json();
  if (ttl) store.cacheSet(cacheKey, data, ttl);
  return data;
}

// --- Genres (id -> nom français) ---
async function genreMaps() {
  const [m, t] = await Promise.all([
    call("/genre/movie/list", { language: LANG }, 7 * 24 * H),
    call("/genre/tv/list", { language: LANG }, 7 * 24 * H),
  ]);
  const byId = {}, byName = {};
  m.genres.concat(t.genres).forEach((g) => { byId[g.id] = g.name; (byName[g.name.toLowerCase()] = byName[g.name.toLowerCase()] || { movie: null, tv: null }); });
  m.genres.forEach((g) => { byName[g.name.toLowerCase()].movie = g.id; });
  t.genres.forEach((g) => { byName[g.name.toLowerCase()].tv = g.id; });
  return { byId, byName, names: [...new Set(m.genres.concat(t.genres).map((g) => g.name))] };
}

// --- Normalisation : forme légère gardée dans la liste partagée ---
const typeOf = (media) => (media === "tv" ? "serie" : "film");
const mediaOf = (ty) => (ty === "serie" ? "tv" : "movie");
const yearOf = (d) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);

function lite(item, media, genres) {
  const m = media || item.media_type;
  if (m !== "movie" && m !== "tv") return null;
  const ids = item.genre_ids || (item.genres || []).map((g) => g.id);
  return {
    id: m + ":" + item.id,
    ty: typeOf(m),
    t: item.title || item.name || "",
    y: yearOf(item.release_date || item.first_air_date),
    p: item.poster_path || null,
    g: ids.map((i) => genres.byId[i]).filter(Boolean),
    len: item.runtime || (item.episode_run_time && item.episode_run_time[0]) || null,
    ov: (item.overview || "").slice(0, 600),
    date: item.release_date || item.first_air_date || null,
    vote: item.vote_average || 0,
  };
}

function parseKey(id) {
  const m = /^(movie|tv):(\d+)$/.exec(String(id));
  return m ? { media: m[1], num: Number(m[2]) } : null;
}

async function search(q, year) {
  const genres = await genreMaps();
  const data = await call("/search/multi", { query: q, language: LANG, include_adult: "false" }, 6 * H);
  let items = (data.results || []).filter((r) => r.media_type === "movie" || r.media_type === "tv");
  if (year) {
    const exact = items.filter((r) => yearOf(r.release_date || r.first_air_date) === year);
    if (exact.length) items = exact;
  }
  return items.slice(0, 12).map((r) => lite(r, r.media_type, genres));
}

// Fiche complète : détails, bande-annonce, plateformes de la région, titres recommandés.
async function details(id, region) {
  const k = parseKey(id);
  if (!k) { const e = new Error("bad_id"); e.status = 400; throw e; }
  const genres = await genreMaps();
  const d = await call("/" + k.media + "/" + k.num, {
    language: LANG,
    append_to_response: "videos,watch/providers,recommendations",
    include_video_language: "fr,en,null",
  }, 12 * H);
  const base = lite(d, k.media, genres);
  const prov = (d["watch/providers"] && d["watch/providers"].results && d["watch/providers"].results[region]) || {};
  const ids = (arr) => (arr || []).map((p) => p.provider_id);
  const vids = ((d.videos && d.videos.results) || []).filter((v) => v.site === "YouTube");
  const trailer = vids.find((v) => v.type === "Trailer" && v.iso_639_1 === "fr") || vids.find((v) => v.type === "Trailer") || vids.find((v) => v.type === "Teaser");
  return Object.assign(base, {
    seasons: d.number_of_seasons || null,
    ov: d.overview || "",
    trailer: trailer ? trailer.key : null,
    av: { f: ids(prov.flatrate), r: ids(prov.rent), b: ids(prov.buy), link: prov.link || null },
    avNames: { f: (prov.flatrate || []).map((p) => p.provider_name), r: (prov.rent || []).map((p) => p.provider_name), b: (prov.buy || []).map((p) => p.provider_name) },
    recs: ((d.recommendations && d.recommendations.results) || []).map((r) => lite(r, r.media_type || k.media, genres)).filter(Boolean),
  });
}

// Plateformes proposées dans la région (films + séries fusionnés), les plus courantes d'abord.
async function providers(region) {
  const [m, t] = await Promise.all([
    call("/watch/providers/movie", { watch_region: region, language: LANG }, 24 * H),
    call("/watch/providers/tv", { watch_region: region, language: LANG }, 24 * H),
  ]);
  const map = {};
  m.results.concat(t.results).forEach((p) => {
    const pr = (p.display_priorities && p.display_priorities[region]) != null ? p.display_priorities[region] : 999;
    if (!map[p.provider_id]) map[p.provider_id] = { id: p.provider_id, name: p.provider_name, logo: p.logo_path, pr };
  });
  return Object.values(map).sort((a, b) => a.pr - b.pr).slice(0, 60).map(({ id, name, logo }) => ({ id, name, logo }));
}

async function discover(media, params) {
  const genres = await genreMaps();
  const data = await call("/discover/" + media, Object.assign({ language: LANG, include_adult: "false", sort_by: "popularity.desc", "vote_count.gte": "150" }, params), 6 * H);
  return (data.results || []).map((r) => lite(r, media, genres)).filter(Boolean);
}

module.exports = { configured, genreMaps, search, details, providers, discover, parseKey, mediaOf, typeOf };
