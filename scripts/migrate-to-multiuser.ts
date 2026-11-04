/**
 * One-time migration: converts the single-tenant data (which belonged to the one
 * hardcoded AUTH_USERNAME/AUTH_PASSWORD account) into multi-user shaped data.
 *
 * - Creates a `users` account from AUTH_USERNAME/AUTH_PASSWORD (skips if it already exists).
 * - Backfills `userId` on every existing workspace_applications/sops/sop_templates/
 *   attachments/admission_payments document that doesn't have one yet.
 * - Renames the old "default" singleton key on emailtemplates/app_settings/userprofiles
 *   to that account's username.
 * - Carries the old global SMTP_* env config into that account's profile, if it hasn't
 *   configured SMTP in the app yet.
 *
 * Usage:
 *   pnpm run migrate:multiuser
 *
 * Env: MONGODB_URI, AUTH_USERNAME, AUTH_PASSWORD (required). Loads `.env.local` from cwd
 * when present. Safe to re-run — every step is idempotent.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI (set in environment or .env.local)");
    process.exit(1);
  }

  const legacyUsername = process.env.AUTH_USERNAME;
  const legacyPassword = process.env.AUTH_PASSWORD;
  if (!legacyUsername || !legacyPassword) {
    console.error(
      "AUTH_USERNAME/AUTH_PASSWORD not found in environment — nothing to migrate from. " +
        "These were the single hardcoded login before multi-user accounts existed."
    );
    process.exit(1);
  }
  const username = legacyUsername.trim().toLowerCase();

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("No database connection");
    process.exit(1);
  }

  // 1. Create the account if it doesn't exist yet
  const users = db.collection("users");
  const existingUser = await users.findOne({ username });
  if (!existingUser) {
    const passwordHash = await bcrypt.hash(legacyPassword, 10);
    await users.insertOne({
      username,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created account "${username}" from AUTH_USERNAME/AUTH_PASSWORD.`);
  } else {
    console.log(`Account "${username}" already exists — skipping creation.`);
  }

  // 2. Backfill userId on every pre-existing document that doesn't have one yet
  const collectionsToBackfill = [
    "workspace_applications",
    "sops",
    "sop_templates",
    "attachments",
    "admission_payments",
  ];
  for (const name of collectionsToBackfill) {
    const res = await db.collection(name).updateMany(
      { userId: { $exists: false } },
      { $set: { userId: username } }
    );
    console.log(`${name}: backfilled userId on ${res.modifiedCount} document(s).`);
  }

  // 3. Rename the old "default" singleton key to the account's username
  const emailTemplateRes = await db
    .collection("emailtemplates")
    .updateMany({ name: "default" }, { $set: { name: username } });
  console.log(`emailtemplates: renamed ${emailTemplateRes.modifiedCount} "default" doc(s) to "${username}".`);

  const appSettingsRes = await db
    .collection("app_settings")
    .updateMany({ key: "default" }, { $set: { key: username } });
  console.log(`app_settings: renamed ${appSettingsRes.modifiedCount} "default" doc(s) to "${username}".`);

  const userProfileRes = await db
    .collection("userprofiles")
    .updateMany({ name: "default" }, { $set: { name: username } });
  console.log(`userprofiles: renamed ${userProfileRes.modifiedCount} "default" doc(s) to "${username}".`);

  // 4. Carry the old global SMTP_* env config into the account's profile, unless it
  // has already configured SMTP through the app.
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const profiles = db.collection("userprofiles");

  if (smtpHost && smtpUser && smtpPass) {
    const profile = await profiles.findOne({ name: username });
    if (profile?.smtp?.pass) {
      console.log("Profile already has an SMTP config — leaving it as-is.");
    } else {
      const port = parseInt(process.env.SMTP_PORT || "587", 10);
      const smtp = {
        provider: "custom",
        host: smtpHost,
        port,
        secure: process.env.SMTP_PORT === "465",
        user: smtpUser,
        pass: smtpPass,
        from: process.env.SMTP_FROM || smtpUser,
      };
      await profiles.updateOne(
        { name: username },
        { $set: { smtp }, $setOnInsert: { fullName: "", email: "" } },
        { upsert: true }
      );
      console.log(`Carried over SMTP_* env config into account "${username}"'s profile (provider: custom).`);
    }
  } else {
    console.log("No SMTP_* env vars found to carry over.");
  }

  await mongoose.disconnect();
  console.log(
    `\nDone. Log in as "${username}" with the old AUTH_PASSWORD. ` +
      "You can now remove AUTH_USERNAME/AUTH_PASSWORD and SMTP_* from your .env — the app no longer reads them."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
