/**
 * Migrates legacy `applications` and `admission_applications` collections into
 * unified `workspace_applications` with discriminator field `kind`.
 *
 * Preserves all `_id` values so SOP refs, attachment refs, and queue items stay valid.
 *
 * Usage:
 *   pnpm run migrate:workspace-applications
 *
 * Env: MONGODB_URI (required). Loads `.env.local` from cwd when present.
 *
 * If `workspace_applications` is non-empty, the script exits unless:
 *   MIGRATE_WORKSPACE_FORCE=1
 * which deletes ALL documents in `workspace_applications` first, then re-migrates.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import mongoose from "mongoose";
import { WORKSPACE_KIND_ADMISSION, WORKSPACE_KIND_EMAIL } from "../lib/constants/workspaceKind";

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

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("No database connection");
    process.exit(1);
  }

  const target = db.collection("workspace_applications");
  const count = await target.countDocuments();
  if (count > 0) {
    if (process.env.MIGRATE_WORKSPACE_FORCE !== "1") {
      console.error(
        `workspace_applications already has ${count} document(s). ` +
          "Refusing to duplicate. Run with MIGRATE_WORKSPACE_FORCE=1 to delete target collection contents and re-run."
      );
      process.exit(1);
    }
    const del = await target.deleteMany({});
    console.log(`MIGRATE_WORKSPACE_FORCE: removed ${del.deletedCount} existing workspace document(s).`);
  }

  const sourceApps = db.collection("applications");
  const sourceAdmissions = db.collection("admission_applications");

  const [legacyAppCount, legacyAdmCount] = await Promise.all([
    sourceApps.countDocuments(),
    sourceAdmissions.countDocuments(),
  ]);

  console.log(`Source applications: ${legacyAppCount}, admission_applications: ${legacyAdmCount}`);

  let emailInserted = 0;
  let admissionInserted = 0;
  const errors: string[] = [];

  const cursor = sourceApps.find({});
  for await (const doc of cursor) {
    const { _id, ...rest } = doc as Record<string, unknown> & { _id: unknown };
    try {
      await target.insertOne({
        _id,
        ...rest,
        kind: WORKSPACE_KIND_EMAIL,
      } as Record<string, unknown>);
      emailInserted++;
    } catch (e) {
      errors.push(`email ${_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const cursorAdm = sourceAdmissions.find({});
  for await (const doc of cursorAdm) {
    const { _id, ...rest } = doc as Record<string, unknown> & { _id: unknown };
    try {
      await target.insertOne({
        _id,
        ...rest,
        kind: WORKSPACE_KIND_ADMISSION,
      } as Record<string, unknown>);
      admissionInserted++;
    } catch (e) {
      errors.push(`admission ${_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const finalCount = await target.countDocuments();
  console.log(
    JSON.stringify(
      {
        insertedEmailOutreach: emailInserted,
        insertedUniversityAdmission: admissionInserted,
        workspaceApplicationsTotal: finalCount,
        errors: errors.length ? errors : undefined,
      },
      null,
      2
    )
  );

  if (errors.length) {
    console.warn("Migration finished with errors (see above).");
    process.exit(1);
  }

  console.log(
    "\nNext steps:\n" +
      "1. Deploy app code that reads workspace_applications.\n" +
      "2. Verify outreach + admissions UIs.\n" +
      "3. Optionally archive or drop legacy collections `applications` and `admission_applications` after backup.\n"
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
