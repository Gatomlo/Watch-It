"use strict";

// Assistant d'envies : comprend une phrase libre et classe des titres déjà choisis par TMDB.
// Trois fournisseurs au choix (clé API enregistrée sur le serveur, chiffrée) : Claude, Gemini, Mistral.
// L'IA ne propose jamais de titres de son cru : elle ne fait que filtrer et classer ce qu'on lui donne.

const store = require("./db");
const { encrypt, decrypt } = require("./cryptoBox");

// Modèle utilisé : celui choisi dans l'appli (Réglages > Assistant d'envies), sinon la variable
// AI_MODEL_<FOURNISSEUR>, sinon la valeur par défaut. Les fournisseurs retirent parfois d'anciens modèles.
const DEFAULTS = { claude: "claude-haiku-5-5", gemini: "gemini-3.5-flash", mistral: "mistral-small-latest" };
function modelOf(provider) {
  return store.getSecret("ai_model_" + provider) || process.env["AI_MODEL_" + provider.toUpperCase()] || DEFAULTS[provider];
}

const PROVIDERS = {
  claude: {
    label: "Claude",
    model: () => modelOf("claude"),
    url: () => process.env.AI_BASE_CLAUDE || "https://api.anthropic.com/v1/messages",
  },
  gemini: {
    label: "Gemini",
    model: () => modelOf("gemini"),
    url: (model) => (process.env.AI_BASE_GEMINI || "https://generativelanguage.googleapis.com/v1beta/models") + "/" + model + ":generateContent",
  },
  mistral: {
    label: "Mistral",
    model: () => modelOf("mistral"),
    url: () => process.env.AI_BASE_MISTRAL || "https://api.mistral.ai/v1/chat/completions",
  },
};

function config() {
  const provider = store.getSecret("ai_provider");
  const enc = store.getSecret("ai_key");
  const key = enc ? decrypt(enc) : null;
  return { provider: PROVIDERS[provider] ? provider : "claude", key };
}

function status() {
  const c = config();
  return {
    provider: c.provider,
    hasKey: !!c.key,
    last4: c.key ? c.key.slice(-4) : null,
    tested: store.getSecret("ai_tested") === "1",
    model: modelOf(c.provider),
    models: Object.fromEntries(Object.keys(PROVIDERS).map((p) => [p, { model: modelOf(p), def: DEFAULTS[p] }])),
  };
}

function save(provider, key, model) {
  if (!PROVIDERS[provider]) { const e = new Error("Fournisseur inconnu."); e.status = 400; throw e; }
  store.setSecret("ai_provider", provider);
  if (typeof model === "string") {
    const m = model.trim();
    if (!m || m === DEFAULTS[provider]) store.deleteSecret("ai_model_" + provider);
    else if (/^[A-Za-z0-9._:\/-]{2,80}$/.test(m)) store.setSecret("ai_model_" + provider, m.replace(/^models\//, ""));
    else { const e = new Error("Nom de modèle invalide."); e.status = 400; throw e; }
  }
  if (typeof key === "string" && key.trim()) {
    store.setSecret("ai_key", encrypt(key.trim()));
  }
  store.setSecret("ai_tested", "0");
}

function clear() {
  ["ai_provider", "ai_key", "ai_tested"].concat(Object.keys(PROVIDERS).map((p) => "ai_model_" + p)).forEach((n) => store.deleteSecret(n));
}

async function post(url, headers, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, headers),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  if (!res.ok) {
    const msg = (json && (json.error && (json.error.message || json.error) || json.message)) || text.slice(0, 200);
    const e = new Error(typeof msg === "string" ? msg : "Erreur du fournisseur IA.");
    e.status = res.status === 401 || res.status === 403 ? 401 : 502;
    e.authFailed = res.status === 401 || res.status === 403;
    // Surcharge passagère du fournisseur (503, 529, « high demand »…) : la clé n'est pas en cause, on réessaie.
    e.transient = [500, 502, 503, 504, 529].indexOf(res.status) >= 0 || /high demand|overloaded|try again later|temporarily/i.test(String(msg));
    e.limited = res.status === 429;
    throw e;
  }
  return json;
}

// Renvoie le texte de la réponse du modèle.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Jusqu'à 3 essais (0,7 s puis 2 s d'attente) quand le fournisseur est momentanément surchargé.
async function complete(provider, key, system, user, maxTokens) {
  let last;
  for (let i = 0; i < 3; i++) {
    try { return await completeOnce(provider, key, system, user, maxTokens); }
    catch (e) { last = e; if (!e.transient) throw e; if (i < 2) await sleep(i === 0 ? 700 : 2000); }
  }
  throw last;
}

async function completeOnce(provider, key, system, user, maxTokens) {
  const p = PROVIDERS[provider];
  const model = p.model();
  if (provider === "claude") {
    const j = await post(p.url(model), { "x-api-key": key, "anthropic-version": "2023-06-01" },
      { model, max_tokens: maxTokens || 1500, system, messages: [{ role: "user", content: user }] });
    return (j.content || []).map((b) => b.text || "").join("");
  }
  if (provider === "gemini") {
    const j = await post(p.url(model), { "x-goog-api-key": key }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens || 1500 },
    });
    const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    return (parts || []).map((x) => x.text || "").join("");
  }
  const j = await post(p.url(model), { Authorization: "Bearer " + key }, {
    model, max_tokens: maxTokens || 1500, response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
}

function parseJson(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = /[\[{][\s\S]*[\]}]/.exec(t);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

async function json(system, user, maxTokens) {
  const c = config();
  if (!c.key) { const e = new Error("no_ai_key"); e.status = 400; throw e; }
  return parseJson(await complete(c.provider, c.key, system, user, maxTokens));
}

async function test() {
  const c = config();
  if (!c.key) return { ok: false, error: "Aucune clé enregistrée." };
  try {
    const out = parseJson(await complete(c.provider, c.key, 'Réponds uniquement par le JSON {"ok":true}.', "Test de connexion.", 50));
    const ok = !!(out && out.ok);
    store.setSecret("ai_tested", ok ? "1" : "0");
    return ok ? { ok: true } : { ok: false, error: "Réponse inattendue du fournisseur." };
  } catch (e) {
    const label = PROVIDERS[c.provider].label;
    // Surcharge ou limite d'utilisation : la clé n'est pas en cause, on ne touche pas à l'état « testée ».
    if (e.transient) return { ok: false, transient: true, error: label + " est surchargé en ce moment (« " + String(e.message).slice(0, 140) + " »). Votre clé n'est pas en cause : réessayez dans quelques minutes." };
    if (e.limited) return { ok: false, transient: true, error: "Limite d'utilisation atteinte chez " + label + " (« " + String(e.message).slice(0, 140) + " »). Votre clé n'est pas en cause : attendez ou vérifiez votre quota." };
    store.setSecret("ai_tested", "0");
    return { ok: false, error: e.authFailed ? "Clé refusée par " + label + "." : (e.message || "Fournisseur injoignable.") };
  }
}

// Modèles proposés par le fournisseur pour la clé enregistrée (pour choisir si le modèle par défaut est retiré).
async function listModels() {
  const c = config();
  if (!c.key) { const e = new Error("Enregistrez d'abord la clé."); e.status = 400; throw e; }
  const get = async (url, headers) => {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error((j.error && (j.error.message || j.error)) || "Liste des modèles indisponible."); e.status = 502; throw e; }
    return j;
  };
  let ids = [];
  if (c.provider === "gemini") {
    const base = process.env.AI_BASE_GEMINI || "https://generativelanguage.googleapis.com/v1beta/models";
    // La liste est paginée : on suit les pages (jusqu'à 6) pour ne manquer aucun modèle récent.
    let models = [], token = "";
    for (let i = 0; i < 6; i++) {
      const j = await get(base + "?pageSize=1000" + (token ? "&pageToken=" + encodeURIComponent(token) : ""), { "x-goog-api-key": c.key });
      models = models.concat(j.models || []);
      token = j.nextPageToken || "";
      if (!token) break;
    }
    ids = models.filter((m) => (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0)
      .map((m) => String(m.name).replace(/^models\//, ""))
      .filter((n) => /^gemini-/.test(n) && !/embedding|imagen|veo|tts|aqa|native-audio|live|robotics|computer-use|image/i.test(n));
  } else if (c.provider === "claude") {
    const j = await get(PROVIDERS.claude.url().replace(/\/messages$/, "/models") + "?limit=100", { "x-api-key": c.key, "anthropic-version": "2023-06-01" });
    ids = (j.data || []).map((m) => m.id);
  } else {
    const j = await get(PROVIDERS.mistral.url().replace(/\/chat\/completions$/, "/models"), { Authorization: "Bearer " + c.key });
    ids = (j.data || []).filter((m) => !m.capabilities || m.capabilities.completion_chat).map((m) => m.id);
  }
  return [...new Set(ids)].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).slice(0, 120);
}

module.exports = { PROVIDERS, DEFAULTS, status, save, clear, json, test, config, listModels };
