"use strict";

// Streaming Availability (Movie of the Night) : facultatif, fournit le lien direct d'un titre chez chaque
// plateforme (TMDB ne le donne pas). Clé saisie dans l'appli, chiffrée en base. Deux origines possibles :
// developers.movieofthenight.com (en-tête X-API-Key) ou RapidAPI (X-RapidAPI-Key).

const store = require("./db");
const { encrypt, decrypt } = require("./cryptoBox");
const tmdb = require("./tmdb");

const BASES = {
  direct: (process.env.SA_BASE || "https://api.movieofthenight.com/v4").replace(/\/$/, ""),
  rapid: (process.env.SA_BASE_RAPID || "https://streaming-availability.p.rapidapi.com").replace(/\/$/, ""),
};
const DAY = 24 * 60 * 60 * 1000;

function mode() { return store.getSecret("sa_mode") === "rapid" ? "rapid" : "direct"; }
function getKey() { const enc = store.getSecret("sa_key"); return enc ? decrypt(enc) : null; }
function status() {
  const k = getKey();
  return k ? { hasKey: true, last4: k.slice(-4), mode: mode() } : { hasKey: false, last4: null, mode: mode() };
}
function headers(key, m) {
  return m === "rapid"
    ? { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "streaming-availability.p.rapidapi.com", Accept: "application/json" }
    : { "X-API-Key": key, Accept: "application/json" };
}
async function fetchShow(id, country, key, m) {
  const url = BASES[m] + "/shows/" + id + "?country=" + encodeURIComponent(country.toLowerCase());
  const res = await fetch(url, { headers: headers(key, m), signal: AbortSignal.timeout(15000) });
  return res;
}
function fail(msg, status) { const e = new Error(msg); e.status = status || 502; return e; }
function errorFor(res) {
  if (res.status === 401 || res.status === 403) return fail("Clé refusée par Streaming Availability. Vérifiez la clé et son origine (directe ou RapidAPI).", 400);
  if (res.status === 429) return fail("Quota de Streaming Availability atteint pour l'instant. Réessayez plus tard.", 429);
  return fail("Streaming Availability a répondu une erreur (" + res.status + ").", 502);
}

// Vérifie une clé avec un titre connu (Titanic) avant de l'enregistrer.
async function check(key, m) {
  try {
    const res = await fetchShow("movie/597", "us", key, m);
    if (res.ok) return { ok: true };
    return { ok: false, error: errorFor(res).message };
  } catch (e) { return { ok: false, error: "Streaming Availability est injoignable. Réessayez plus tard." }; }
}
function save(key, m) {
  store.setSecret("sa_key", encrypt(key));
  store.setSecret("sa_mode", m === "rapid" ? "rapid" : "direct");
}
function clear() { ["sa_key", "sa_mode"].forEach((n) => store.deleteSecret(n)); }

const TYPE_ORDER = { subscription: 0, free: 1, addon: 2, rent: 3, buy: 4 };
// Liens directs d'un titre (id « movie:123 » ou « tv:456 ») dans un pays : [{ service, name, type, link }].
async function links(id, region, fresh) {
  const key = getKey();
  if (!key) throw fail("Clé Streaming Availability non configurée.", 400);
  const k = tmdb.parseKey(id);
  if (!k) throw fail("bad_id", 400);
  const country = String(region || "BE").toLowerCase();
  const ck = "sa:" + k.media + ":" + k.num + ":" + country;
  const hit = fresh ? null : store.cacheGet(ck);
  if (hit) return hit;
  const res = await fetchShow(k.media + "/" + k.num, country, key, mode()).catch(() => { throw fail("Streaming Availability est injoignable."); });
  let out = [];
  if (res.status === 404) out = [];
  else if (!res.ok) throw errorFor(res);
  else {
    const j = await res.json().catch(() => ({}));
    const opts = (j.streamingOptions && j.streamingOptions[country]) || [];
    out = opts.filter((o) => o && o.link && o.service).map((o) => ({
      service: String(o.service.id || ""), name: String(o.service.name || o.service.id || ""), type: o.type || "subscription", link: o.link,
    }));
    out.sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));
  }
  store.cacheSet(ck, out, out.length ? DAY : 6 * 60 * 60 * 1000);
  return out;
}

// Marque d'une plateforme d'après son nom (même logique que le front : TMDB et SA nomment un peu différemment).
function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
function brandOf(name) {
  const n = norm(name);
  if (/netflix/.test(n)) return "netflix";
  if (/\bhbo\b|\bmax\b/.test(n)) return "max";
  if (/prime video|amazon prime/.test(n)) return "prime";
  if (/disney/.test(n)) return "disney";
  if (/apple tv/.test(n)) return "apple";
  if (/canal/.test(n)) return "canal";
  if (/paramount/.test(n)) return "paramount";
  if (/youtube/.test(n)) return "youtube";
  return n;
}

// Seconde source de disponibilité : si une clé est configurée et que TMDB ne place pas le titre sur une
// plateforme du foyer, complète `d.av.f` avec les offres d'abonnement/gratuit/add-on de Streaming Availability
// (traduites en identifiants de plateformes TMDB). Silencieux en cas d'erreur ; économise le quota autrement.
async function enrich(d, region, platIds, fresh) {
  if (!d || !d.av || !getKey()) return d;
  if ((platIds || []).length && d.av.f.some((p) => platIds.indexOf(p) >= 0)) return d;
  let ls;
  try { ls = await links(d.id, region, fresh); } catch (e) { return d; }
  const brands = new Set(ls.filter((l) => l.type === "subscription" || l.type === "free" || l.type === "addon").map((l) => brandOf(l.name)));
  if (!brands.size) return d;
  let provs = [];
  try { provs = await tmdb.providers(region); } catch (e) { return d; }
  provs.forEach((p) => { if (brands.has(brandOf(p.name)) && d.av.f.indexOf(p.id) < 0) d.av.f.push(p.id); });
  return d;
}

module.exports = { status, save, clear, check, links, mode, enrich };
