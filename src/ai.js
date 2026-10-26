"use strict";

// Assistant d'envies : comprend une phrase libre et classe des titres déjà choisis par TMDB.
// Trois fournisseurs au choix (clé API enregistrée sur le serveur, chiffrée) : Claude, Gemini, Mistral.
// L'IA ne propose jamais de titres de son cru : elle ne fait que filtrer et classer ce qu'on lui donne.

const store = require("./db");
const { encrypt, decrypt } = require("./cryptoBox");

const PROVIDERS = {
  claude: {
    label: "Claude",
    model: () => process.env.AI_MODEL_CLAUDE || "claude-haiku-5-5",
    url: () => process.env.AI_BASE_CLAUDE || "https://api.anthropic.com/v1/messages",
  },
  gemini: {
    label: "Gemini",
    model: () => process.env.AI_MODEL_GEMINI || "gemini-2.5-flash",
    url: (model) => (process.env.AI_BASE_GEMINI || "https://generativelanguage.googleapis.com/v1beta/models") + "/" + model + ":generateContent",
  },
  mistral: {
    label: "Mistral",
    model: () => process.env.AI_MODEL_MISTRAL || "mistral-small-latest",
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
  };
}

function save(provider, key) {
  if (!PROVIDERS[provider]) { const e = new Error("Fournisseur inconnu."); e.status = 400; throw e; }
  store.setSecret("ai_provider", provider);
  if (typeof key === "string" && key.trim()) {
    store.setSecret("ai_key", encrypt(key.trim()));
  }
  store.setSecret("ai_tested", "0");
}

function clear() {
  ["ai_provider", "ai_key", "ai_tested"].forEach((n) => store.deleteSecret(n));
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
    throw e;
  }
  return json;
}

// Renvoie le texte de la réponse du modèle.
async function complete(provider, key, system, user, maxTokens) {
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
    store.setSecret("ai_tested", "0");
    return { ok: false, error: e.authFailed ? "Clé refusée par " + PROVIDERS[c.provider].label + "." : (e.message || "Fournisseur injoignable.") };
  }
}

module.exports = { PROVIDERS, status, save, clear, json, test, config };
