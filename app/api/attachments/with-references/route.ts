import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { WorkspaceApplicationModel } from "@/lib/models/WorkspaceApplication";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";
import { WORKSPACE_KIND_ADMISSION } from "@/lib/constants/workspaceKind";
import { getSession } from "@/lib/auth";
import type { AttachmentWithUsage } from "@/lib/types/attachment-usage";

export const dynamic = "force-dynamic";

/**
 * GET all of this account's attachments with where each one is used, grouped by kind.
 * Usage is read from the applications and template themselves (same source of truth as cleanup),
 * not from the denormalized referencedBy* fields, so "Not used" here always matches what cleanup deletes.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Exclude `content` — files can be large.
    const [attachments, applications, template] = await Promise.all([
      AttachmentModel.find({ userId: session.username })
        .select("_id filename contentType size createdAt")
        .sort({ createdAt: -1 })
        .lean()
        .allowDiskUse(true),
      WorkspaceApplicationModel.find(
        { userId: session.username, "attachments.0": { $exists: true } },
        "_id kind name email universityName programName attachments"
      ).lean(),
      EmailTemplateModel.findOne({ name: session.username }, "attachments").lean(),
    ]);

    const usage = new Map<string, Pick<AttachmentWithUsage, "outreach" | "admissions">>();
    const usageFor = (id: string) => {
      let entry = usage.get(id);
      if (!entry) usage.set(id, (entry = { outreach: [], admissions: [] }));
      return entry;
    };

    for (const app of applications as any[]) {
      const id = app._id.toString();
      for (const attachmentId of app.attachments ?? []) {
        const entry = usageFor(String(attachmentId));
        if (app.kind === WORKSPACE_KIND_ADMISSION) {
          entry.admissions.push({
            id,
            label: [app.universityName, app.programName].filter(Boolean).join(" – ") || "Untitled application",
          });
        } else {
          entry.outreach.push({ id, name: app.name || app.email || "Unnamed contact", email: app.email ?? "" });
        }
      }
    }

    const templateIds = new Set(((template as any)?.attachments ?? []).map((id: unknown) => String(id)));

    const result: AttachmentWithUsage[] = (attachments as any[]).map((att) => {
      const id = att._id.toString();
      const { outreach, admissions } = usage.get(id) ?? { outreach: [], admissions: [] };
      const inTemplate = templateIds.has(id);
      return {
        _id: id,
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        createdAt: att.createdAt,
        outreach,
        admissions,
        inTemplate,
        referenceCount: outreach.length + admissions.length + (inTemplate ? 1 : 0),
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching attachments with references:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch attachments" }, { status: 500 });
  }
}
