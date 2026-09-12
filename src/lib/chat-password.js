import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Hashing for the optional password that gates a project's public chat.
 *
 * This was stored and compared in plaintext (backend/chat.py's
 * verify_chat_password), and served back to the settings UI on every
 * project load.
 *
 * The api_keys precedent used bare SHA-256, which is correct for a
 * high-entropy random key and wrong here: a chat password is chosen by a
 * human, so it needs a slow, salted KDF. scrypt is in both standard
 * libraries — crypto here, hashlib in backend/chat.py — so this costs no
 * new dependency on either side.
 *
 * Encoding is `scrypt$N$r$p$salt_b64$hash_b64`, parsed identically by both.
 * Keep the two implementations in step: a change to these parameters must
 * land in backend/chat.py's _verify_chat_password at the same time.
 */
const N = 16384; // CPU/memory cost. 128 * N * r = ~16 MB per hash.
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export const MIN_CHAT_PASSWORD_LENGTH = 6;
export const MAX_CHAT_PASSWORD_LENGTH = 128;

export function hashChatPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Verifies a candidate against a stored hash. Never throws on bad input. */
export function verifyChatPassword(password, stored) {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(String(password ?? ""), salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Returns an error string, or null when the password is acceptable.
 * Deliberately looser than src/lib/password.js's account rules — this is a
 * shared gate a merchant hands to visitors, not a login credential.
 */
export function validateChatPassword(password) {
  const value = String(password ?? "");
  if (value.length < MIN_CHAT_PASSWORD_LENGTH) {
    return `Chat password must be at least ${MIN_CHAT_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_CHAT_PASSWORD_LENGTH) {
    return `Chat password must be at most ${MAX_CHAT_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
