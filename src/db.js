"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// Même convention que Fée Lezcomptes : DATA_DIR relatif = relatif à ce projet.
const DATA_DIR = path.resolve(__dirname, "..", process.env.DATA_DIR || "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    expires INTEGER NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS secrets (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cache (
    k TEXT PRIMARY KEY,
    expires INTEGER NOT NULL,
    data TEXT NOT NULL
  );
`);

// L'état partagé (liste, notes, profils, plateformes) est un seul JSON numéroté.
const DEFAULT_STATE = {
  settings: { region: "BE", platforms: [], profiles: { M: "Moi", E: "Elle" } },
  list: [],
  dismissed: { M: [], E: [] },
};

function ensureDefaultState() {
  if (db.prepare("SELECT id FROM app_state WHERE id = 1").get()) return;
  db.prepare("INSERT INTO app_state (id, data) VALUES (1, ?)").run(JSON.stringify(DEFAULT_STATE));
}

ensureDefaultState();

const userCount = () => db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
// Crée le premier (et seul) compte ; ne fait rien s'il en existe déjà un (atomique). Renvoie l'id ou null.
function createFirstUser(username, hash) {
  const r = db.prepare("INSERT INTO users (username, password_hash) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)").run(username, hash);
  return r.changes ? Number(r.lastInsertRowid) : null;
}
const getUser = (username) => db.prepare("SELECT * FROM users WHERE username = ?").get(username);
const getFirstUser = () => db.prepare("SELECT * FROM users ORDER BY id LIMIT 1").get();
const updateUsername = (id, name) =>
  db.prepare("UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
const updatePasswordHash = (id, hash) =>
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, id);

function getState() {
  const row = db.prepare("SELECT data FROM app_state WHERE id = 1").get();
  return row ? JSON.parse(row.data) : JSON.parse(JSON.stringify(DEFAULT_STATE));
}
function getStateVersion() {
  const row = db.prepare("SELECT version FROM app_state WHERE id = 1").get();
  return row ? row.version : 0;
}
// Renvoie la nouvelle version, ou null si baseVersion est dépassée (le client fusionne puis renvoie).
function saveState(state, baseVersion) {
  const json = JSON.stringify(state);
  const r = baseVersion == null
    ? db.prepare("UPDATE app_state SET data = ?, version = version + 1, updated_at = datetime('now') WHERE id = 1").run(json)
    : db.prepare("UPDATE app_state SET data = ?, version = version + 1, updated_at = datetime('now') WHERE id = 1 AND version = ?").run(json, baseVersion);
  return r.changes ? getStateVersion() : null;
}

function getSecret(name) {
  const row = db.prepare("SELECT value FROM secrets WHERE name = ?").get(name);
  return row ? row.value : null;
}
function setSecret(name, value) {
  db.prepare(
    "INSERT INTO secrets (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(name, value);
}
function deleteSecret(name) {
  db.prepare("DELETE FROM secrets WHERE name = ?").run(name);
}

function cacheGet(k) {
  const row = db.prepare("SELECT data, expires FROM cache WHERE k = ?").get(k);
  if (!row || row.expires < Date.now()) return null;
  try { return JSON.parse(row.data); } catch (e) { return null; }
}
function cacheSet(k, data, ttlMs) {
  db.prepare(
    "INSERT INTO cache (k, expires, data) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET expires = excluded.expires, data = excluded.data"
  ).run(k, Date.now() + ttlMs, JSON.stringify(data));
}
function cachePurge() {
  db.prepare("DELETE FROM cache WHERE expires < ?").run(Date.now());
}
cachePurge();

module.exports = {
  db, userCount, createFirstUser, getUser, getFirstUser, updateUsername, updatePasswordHash,
  getState, getStateVersion, saveState, getSecret, setSecret, deleteSecret,
  cacheGet, cacheSet, cachePurge, DEFAULT_STATE,
};
