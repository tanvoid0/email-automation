import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
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
    const attachment = await AttachmentModel.findOneAndDelete({ _id: id, userId: session.username });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Attachment deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete attachment" },
      { status: 500 }
    );
  }
}

