"use strict";

const crypto = require("crypto");

// Chiffre les secrets (clé API IA) avant de les ranger dans SQLite : AES-256-GCM, clé
// dérivée de SECRETS_KEY (à défaut SESSION_SECRET). Format : base64(iv | tag | texte chiffré).
let cachedKey = null;
function key() {
  if (cachedKey) return cachedKey;
  const secret = process.env.SECRETS_KEY || process.env.SESSION_SECRET || "";
  if (!secret || /^change-this/.test(secret)) {
    // Sans vraie valeur : clé dérivée d'un texte fixe (acceptable en test local seulement).
    if (process.env.NODE_ENV === "production") {
      throw new Error("[mAIwatch] SECRETS_KEY manquant ou laissé par défaut dans .env.");
    }
    console.warn("[mAIwatch] SECRETS_KEY absent : chiffrement des secrets avec une valeur de test.");
  }
  cachedKey = crypto.scryptSync(secret || "maiwatch-dev-only", "maiwatch-secrets", 32);
  return cachedKey;
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

function decrypt(b64) {
  try {
    const buf = Buffer.from(String(b64), "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch (e) {
    return null;
  }
}

module.exports = { encrypt, decrypt };
