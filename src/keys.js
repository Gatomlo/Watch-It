"use strict";

// Clés internes générées automatiquement au premier démarrage (aucun .env à écrire) :
//  - session : signe les cookies de session ;
//  - secrets : chiffre les clés API enregistrées dans l'appli (TMDB, IA).
// Elles vivent dans data/keys.json (droits 600), à côté de la base. Perdre ce fichier oblige
// à se reconnecter et à ressaisir les clés API ; à sauvegarder avec data/app.db.
// SESSION_SECRET et SECRETS_KEY dans l'environnement restent possibles (avancé) et priment.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.resolve(__dirname, "..", process.env.DATA_DIR || "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, "keys.json");

function load() {
  let keys = {};
  try { keys = JSON.parse(fs.readFileSync(FILE, "utf8")) || {}; } catch (e) {}
  let changed = false;
  ["session", "secrets"].forEach((k) => {
    if (typeof keys[k] !== "string" || keys[k].length < 32) { keys[k] = crypto.randomBytes(48).toString("hex"); changed = true; }
  });
  if (changed) fs.writeFileSync(FILE, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

const keys = load();
module.exports = {
  session: process.env.SESSION_SECRET || keys.session,
  secrets: process.env.SECRETS_KEY || keys.secrets,
};
