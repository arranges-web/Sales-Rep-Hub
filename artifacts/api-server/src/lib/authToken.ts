import crypto from "node:crypto";
import { getSetting, setSetting } from "./settings";

/**
 * Lightweight session tokens for the username + team-password login. We don't
 * need JWT's full surface — a compact `payload.signature` string, HMAC-signed
 * with a server-side secret, is enough to prove "this browser logged in as
 * user X" without a third-party auth provider.
 *
 * The signing secret lives in app_settings so it survives restarts (a fresh
 * random secret each boot would invalidate everyone's session on every
 * deploy). It's created once, lazily, and cached in memory.
 */

const AUTH_SECRET_KEY = "auth_secret";
const TEAM_PASSWORD_KEY = "team_password_hash";
// Sessions are long-lived — this is an internal tool reps keep open all day.
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 60; // 60 days

let cachedSecret: string | null = null;

async function getAuthSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  const existing = await getSetting(AUTH_SECRET_KEY);
  if (existing) {
    cachedSecret = existing;
    return existing;
  }
  const fresh = crypto.randomBytes(32).toString("hex");
  await setSetting(AUTH_SECRET_KEY, fresh);
  cachedSecret = fresh;
  return fresh;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, "base64").toString("utf8");
}

function sign(payloadB64: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

interface TokenPayload {
  uid: string;
  iat: number;
}

export async function signToken(uid: string): Promise<string> {
  const secret = await getAuthSecret();
  const payload: TokenPayload = { uid, iat: Date.now() };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/** Returns the uid the token authenticates, or null if invalid/expired. */
export async function verifyToken(token: string): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  const secret = await getAuthSecret();
  const expectedSig = sign(payloadB64, secret);

  // Constant-time compare to avoid leaking signature bytes via timing.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(payloadB64)) as TokenPayload;
    if (!payload.uid || typeof payload.iat !== "number") return null;
    if (Date.now() - payload.iat > TOKEN_TTL_MS) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

// ── Shared team password ───────────────────────────────────────────────────
// Stored as a salted SHA-256 hash, never plaintext. When unset, login is open
// (needed to bootstrap the very first admin before a password exists).

function hashPassword(plain: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`pw:${plain}`).digest("hex");
}

export async function isTeamPasswordSet(): Promise<boolean> {
  return !!(await getSetting(TEAM_PASSWORD_KEY));
}

export async function setTeamPassword(plain: string | null): Promise<void> {
  if (!plain || plain.trim().length === 0) {
    // Empty clears it → open access again.
    await setSetting(TEAM_PASSWORD_KEY, "");
    return;
  }
  const secret = await getAuthSecret();
  await setSetting(TEAM_PASSWORD_KEY, hashPassword(plain.trim(), secret));
}

/** True when the supplied password is accepted (or when none is required). */
export async function verifyTeamPassword(plain: unknown): Promise<boolean> {
  const stored = await getSetting(TEAM_PASSWORD_KEY);
  if (!stored) return true; // open access — no password configured yet
  if (typeof plain !== "string" || plain.length === 0) return false;
  const secret = await getAuthSecret();
  const candidate = hashPassword(plain.trim(), secret);
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
