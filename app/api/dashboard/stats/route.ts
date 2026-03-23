import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_EMAIL,
  WORKSPACE_KIND_ADMISSION,
} from "@/lib/models/WorkspaceApplication";
import { SOPModel } from "@/lib/models/SOP";
import { AttachmentModel } from "@/lib/models/Attachment";
import { SopTemplateModel } from "@/lib/models/SopTemplate";
import { NotificationModel } from "@/lib/models/Notification";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";

type AppStatus = "pending" | "sending" | "sent" | "error" | "cancelled";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const [
      applicationsTotal,
      admissionsTotal,
      sopsTotal,
      attachmentsTotal,
      sopTemplatesTotal,
      notificationsUnread,
      statusAgg,
    ] = await Promise.all([
      WorkspaceApplicationModel.countDocuments({ kind: WORKSPACE_KIND_EMAIL }),
      WorkspaceApplicationModel.countDocuments({ kind: WORKSPACE_KIND_ADMISSION }),
      SOPModel.countDocuments(),
      AttachmentModel.countDocuments(),
      SopTemplateModel.countDocuments(),
      NotificationModel.countDocuments({
        userId: session.username,
        read: false,
      }),
      WorkspaceApplicationModel.aggregate<{ _id: AppStatus; count: number }>([
        { $match: { kind: WORKSPACE_KIND_EMAIL } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const outreachByStatus: Record<AppStatus, number> = {
      pending: 0,
      sending: 0,
      sent: 0,
      error: 0,
      cancelled: 0,
    };
    for (const row of statusAgg) {
      if (row._id && row._id in outreachByStatus) {
        outreachByStatus[row._id] = row.count;
      }
    }

    return NextResponse.json({
      outreachApplications: {
        total: applicationsTotal,
        byStatus: outreachByStatus,
      },
      admissionApplications: { total: admissionsTotal },
      sops: { total: sopsTotal },
      attachments: { total: attachmentsTotal },
      sopTemplates: { total: sopTemplatesTotal },
      notifications: { unread: notificationsUnread },
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("[dashboard/stats]", errorMessage);
    const body: ApiErrorResponse = {
      error: errorMessage || "Failed to load dashboard stats",
    };
    return NextResponse.json(body, { status: 500 });
  }
}
