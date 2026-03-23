/**
 * Moves legacy embedded application-fee fields on `workspace_applications` into
 * `admission_payments` documents, then unsets those fields.
 *
 * Usage: pnpm run migrate:admission-payments
 * Env: MONGODB_URI (required). Loads `.env.local` when present.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import mongoose from "mongoose";
import { WORKSPACE_KIND_ADMISSION } from "../lib/constants/workspaceKind";

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

loadEnvLocal();

type LegacyDoc = {
  _id: mongoose.Types.ObjectId;
  applicationFeeAmountText?: string;
  applicationFeeCurrency?: string;
  applicationFeePaymentUrl?: string;
  applicationFeePaidAt?: string;
  applicationFeeNotes?: string;
  applicationFeeStatus?: string;
};

function mapStatus(
  s?: string
): { status: "pending" | "paid" | "waived"; paidAt?: Date } {
  if (s === "paid") {
    return { status: "paid" };
  }
  if (s === "waived") {
    return { status: "waived" };
  }
  return { status: "pending" };
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  const coll = mongoose.connection.db!.collection("workspace_applications");

  const filter = {
    kind: WORKSPACE_KIND_ADMISSION,
    $or: [
      { applicationFeeAmountText: { $exists: true, $nin: [null, ""] } },
      { applicationFeeCurrency: { $exists: true, $nin: [null, ""] } },
      { applicationFeePaymentUrl: { $exists: true, $nin: [null, ""] } },
      { applicationFeePaidAt: { $exists: true, $nin: [null, ""] } },
      { applicationFeeNotes: { $exists: true, $nin: [null, ""] } },
      { applicationFeeStatus: { $exists: true, $nin: [null, ""] } },
    ],
  };

  const cursor = coll.find(filter);
  let migrated = 0;
  const payColl = mongoose.connection.db!.collection("admission_payments");

  for await (const raw of cursor) {
    const doc = raw as LegacyDoc;
    const { status, paidAt: _ } = mapStatus(doc.applicationFeeStatus);
    let paidAt: Date | undefined;
    if (doc.applicationFeePaidAt?.trim()) {
      const d = new Date(doc.applicationFeePaidAt.trim());
      if (!Number.isNaN(d.getTime())) paidAt = d;
    }
    if (status === "paid" && !paidAt) {
      paidAt = new Date();
    }

    await payColl.insertOne({
      workspaceApplicationId: doc._id,
      label: "Application fee",
      amountText: doc.applicationFeeAmountText?.trim() || undefined,
      currency: doc.applicationFeeCurrency?.trim() || undefined,
      paymentUrl: doc.applicationFeePaymentUrl?.trim() || undefined,
      note: doc.applicationFeeNotes?.trim() || undefined,
      status,
      paidAt: status === "paid" ? paidAt : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await coll.updateOne(
      { _id: doc._id },
      {
        $unset: {
          applicationFeeAmountText: "",
          applicationFeeCurrency: "",
          applicationFeePaymentUrl: "",
          applicationFeePaidAt: "",
          applicationFeeNotes: "",
          applicationFeeStatus: "",
        },
      }
    );
    migrated += 1;
  }

  console.log(`Migrated ${migrated} admission(s) to admission_payments.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
