import { hmacSha256 } from "./sha256";

/**
 * Password hashing: PBKDF2-HMAC-SHA256, stored in the portable Django/passlib
 * format `pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>`.
 *
 * The format matters more than the implementation. Because the algorithm, cost
 * and salt all travel inside the string, a future remote backend (Django, Node,
 * Python/passlib, Go) can verify these exact hashes without a migration, and this
 * client can verify hashes that backend produces. Nothing outside this file knows
 * how a password is stored.
 */

const ALGORITHM = "pbkdf2_sha256";
const SALT_BYTES = 16;
const DERIVED_BYTES = 32;

/**
 * Cost. Deliberately far below the ~600k OWASP recommends for server-side PBKDF2:
 * this runs single-threaded in JS on the phone, and higher counts visibly block
 * the login button. It is the honest trade-off for on-device auth in a prototype —
 * when authentication moves to a real backend, raise this there, where the work
 * costs a server core instead of the user's frame budget.
 */
const ITERATIONS = 10_000;

function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLen: number,
): Uint8Array {
  const out = new Uint8Array(keyLen);
  const blocks = Math.ceil(keyLen / 32);

  for (let block = 1; block <= blocks; block++) {
    // U1 = HMAC(password, salt || INT_32_BE(block))
    const input = new Uint8Array(salt.length + 4);
    input.set(salt);
    new DataView(input.buffer).setUint32(salt.length, block, false);

    let u = hmacSha256(password, input);
    const acc = u.slice();

    for (let i = 1; i < iterations; i++) {
      u = hmacSha256(password, u);
      for (let j = 0; j < acc.length; j++) acc[j] ^= u[j];
    }

    out.set(acc.subarray(0, Math.min(32, keyLen - (block - 1) * 32)), (block - 1) * 32);
  }
  return out;
}

function utf8(s: string): Uint8Array {
  // TextEncoder is not guaranteed in the RN runtime; encode manually.
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      // Surrogate pair -> single code point.
      const lo = s.charCodeAt(++i);
      c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
      bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "");
  const out = new Uint8Array((clean.length * 3) >> 2);
  let acc = 0, bits = 0, n = 0;
  for (const ch of clean) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

/**
 * Salt bytes. Prefers the platform CSPRNG; falls back to Math.random only if the
 * runtime exposes no crypto at all. The fallback is weaker — it makes precomputed
 * (rainbow) tables cheaper if the database file is stolen — but a per-user salt
 * from any source still defeats cross-user hash reuse, and this never protects
 * anything but the on-device prototype database.
 */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (typeof g.crypto?.getRandomValues === "function") {
    g.crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/** Hashes a plaintext password into the storable encoded string. */
export function hashPassword(password: string, iterations = ITERATIONS): string {
  const salt = randomBytes(SALT_BYTES);
  const dk = pbkdf2Sha256(utf8(password), salt, iterations, DERIVED_BYTES);
  return `${ALGORITHM}$${iterations}$${toBase64(salt)}$${toBase64(dk)}`;
}

/**
 * Verifies a plaintext password against a stored hash. Returns false rather than
 * throwing on a malformed or unknown-algorithm hash, so one bad row can't break
 * the login screen.
 */
export function verifyPassword(password: string, encoded: string): boolean {
  const parts = encoded.split("$");
  if (parts.length !== 4) return false;
  const [algorithm, iterStr, saltB64, hashB64] = parts;
  if (algorithm !== ALGORITHM) return false;

  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  const expected = fromBase64(hashB64);
  const actual = pbkdf2Sha256(utf8(password), fromBase64(saltB64), iterations, expected.length);

  // Constant-time compare: don't leak how much of the hash matched via timing.
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
