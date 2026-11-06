import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { WorkspaceApplicationModel } from "@/lib/models/WorkspaceApplication";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";
import { repointAttachmentReferences } from "@/lib/utils/attachments";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET single attachment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;
    const attachment = await AttachmentModel.findOne({ _id: id, userId: session.username });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(attachment);
  } catch (error: any) {
    console.error("Error fetching attachment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch attachment" },
      { status: 500 }
    );
  }
}

// DELETE attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;
    const owned = await AttachmentModel.exists({ _id: id, userId: session.username });
    if (!owned) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Detach before deleting: a failure in between leaves an unused file, never a broken reference.
    const detachedFrom = await repointAttachmentReferences(
      WorkspaceApplicationModel,
      EmailTemplateModel,
      session.username,
      id,
      null
    );
    await AttachmentModel.deleteOne({ _id: id, userId: session.username });

    return NextResponse.json({ message: "Attachment deleted", detachedFrom });
  } catch (error: any) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete attachment" },
      { status: 500 }
    );
  }
}

