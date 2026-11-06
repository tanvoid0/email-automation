/**
 * Self-check for lib/session-token.ts. Run: pnpm check:session
 * Exits non-zero if a forged, tampered, legacy or expired token is accepted.
 */
import assert from "node:assert/strict";

async function main() {
  const { signSession, verifySession } = await import("../lib/session-token");

  delete process.env.SESSION_SECRET;
  await assert.rejects(() => signSession({ username: "a", expiresAt: Date.now() + 1000 }), /SESSION_SECRET/);
  await assert.rejects(() => verifySession("a.b"), /SESSION_SECRET/, "missing secret fails loudly, not as a logout");

  process.env.SESSION_SECRET = "x".repeat(40); // a failed lookup caches nothing, so this takes effect

  const session = { username: "alice", expiresAt: Date.now() + 60_000 };
  const token = await signSession(session);
  assert.deepEqual(await verifySession(token), session, "valid token round-trips");

  const [, sig] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ ...session, username: "bob" })).toString("base64url");
  assert.equal(await verifySession(`${forgedPayload}.${sig}`), null, "swapped username rejected");

  const legacy = Buffer.from(JSON.stringify(session)).toString("base64");
  assert.equal(await verifySession(legacy), null, "old unsigned cookie rejected");

  assert.equal(await verifySession(`${token}.extra`), null, "extra segment rejected");
  assert.equal(await verifySession("garbage"), null, "garbage rejected");

  const expired = await signSession({ username: "alice", expiresAt: Date.now() - 1 });
  assert.equal(await verifySession(expired), null, "expired token rejected");

  const unicode = { username: "zoë-测试", expiresAt: Date.now() + 60_000 };
  assert.deepEqual(await verifySession(await signSession(unicode)), unicode, "non-ASCII username round-trips");

  console.log("session-token: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
