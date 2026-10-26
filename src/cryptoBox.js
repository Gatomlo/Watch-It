"use strict";

const crypto = require("crypto");
const keys = require("./keys");

// Chiffre les secrets (clés API) avant de les ranger dans SQLite : AES-256-GCM, clé dérivée
// de la clé interne `secrets` (voir keys.js). Format : base64(iv | tag | texte chiffré).
const KEY = crypto.scryptSync(keys.secrets, "maiwatch-secrets", 32);

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

function decrypt(b64) {
  try {
    const buf = Buffer.from(String(b64), "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch (e) {
    return null;
  }
}

module.exports = { encrypt, decrypt };
