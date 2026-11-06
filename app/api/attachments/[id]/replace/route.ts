import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { WorkspaceApplicationModel } from "@/lib/models/WorkspaceApplication";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";
import { repointAttachmentReferences } from "@/lib/utils/attachments";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const replaceSchema = z.object({
  /** An attachment already uploaded via POST /api/attachments. */
  newId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid attachment id"),
  deleteOld: z.boolean().default(true),
});

/**
 * POST /api/attachments/:id/replace — swap this file for a newer one everywhere it is used
 * (outreach emails, admission applications, the email template), optionally deleting the old file.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = replaceSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    const { id } = await params;
    const { newId, deleteOld } = parsed.data;
    if (newId === id) {
      return NextResponse.json({ error: "That's the same file — nothing to replace." }, { status: 400 });
    }

    await connectDB();
    const owned = await AttachmentModel.countDocuments({ _id: { $in: [id, newId] }, userId: session.username });
    if (owned !== 2) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const replacedIn = await repointAttachmentReferences(
      WorkspaceApplicationModel,
      EmailTemplateModel,
      session.username,
      id,
      newId
    );
    if (deleteOld) {
      await AttachmentModel.deleteOne({ _id: id, userId: session.username });
    }

    return NextResponse.json({ replacedIn, deletedOld: deleteOld, newId });
  } catch (error: any) {
    console.error("Error replacing attachment:", error);
    return NextResponse.json({ error: error.message || "Failed to replace attachment" }, { status: 500 });
  }
}
