/**
 * Signed session tokens: `base64url(json).base64url(hmacSha256(json))`.
 * Web Crypto only, so the same code runs in middleware (Edge) and route handlers (Node).
 */

export interface AuthSession {
  username: string;
  expiresAt: number;
}

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | undefined;

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("SESSION_SECRET is missing or shorter than 32 characters. Set it in the environment.");
    }
    keyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  }
  return keyPromise;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function signSession(session: AuthSession): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the session only if the signature is valid and it has not expired. Throws if SESSION_SECRET is unset. */
export async function verifySession(token: string): Promise<AuthSession | null> {
  const key = await getKey(); // outside the try: a missing secret must fail loudly, not look like a logout
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [payload, signature] = parts;
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Partial<AuthSession>;
    if (typeof session.username !== "string" || typeof session.expiresAt !== "number") return null;
    if (Date.now() > session.expiresAt) return null;
    return { username: session.username, expiresAt: session.expiresAt };
  } catch {
    return null;
  }
}
