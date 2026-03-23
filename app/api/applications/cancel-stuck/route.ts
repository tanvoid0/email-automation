import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_EMAIL,
} from "@/lib/models/WorkspaceApplication";
import type { ApiErrorResponse } from "@/lib/types/api";
import { getErrorMessage } from "@/lib/types/errors";

export const dynamic = "force-dynamic";

/**
 * Cancel applications stuck in "sending" status
 * This endpoint finds all applications with status "sending" and sets them to "cancelled"
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    // Find all applications stuck in "sending" status
    const stuckApplications = await WorkspaceApplicationModel.find({
      kind: WORKSPACE_KIND_EMAIL,
      status: "sending",
    });
    
    if (stuckApplications.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stuck applications found",
        cancelledCount: 0,
      });
    }

    // Update all stuck applications to "cancelled" status and clear errors
    const updateResult = await WorkspaceApplicationModel.updateMany(
      { kind: WORKSPACE_KIND_EMAIL, status: "sending" },
      { 
        $set: { 
          status: "cancelled",
          error: undefined,
          errorDetails: undefined,
        }
      }
    );

    console.log('[Cancel Stuck] Cancelled stuck applications:', {
      found: stuckApplications.length,
      updated: updateResult.modifiedCount,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Cancelled ${updateResult.modifiedCount} stuck application(s)`,
      cancelledCount: updateResult.modifiedCount,
      applicationIds: stuckApplications.map(app => app._id.toString()),
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("[Cancel Stuck] Error cancelling stuck applications:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to cancel stuck applications",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * GET endpoint to check for stuck applications without cancelling them
 */
export async function GET() {
  try {
    await connectDB();
    
    const stuckApplications = await WorkspaceApplicationModel.find({
      kind: WORKSPACE_KIND_EMAIL,
      status: "sending",
    });
    
    return NextResponse.json({
      stuckCount: stuckApplications.length,
      applications: stuckApplications.map(app => ({
        id: app._id.toString(),
        name: app.name,
        email: app.email,
        status: app.status,
        updatedAt: (app as any).updatedAt || new Date(),
      })),
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("[Cancel Stuck] Error checking stuck applications:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to check stuck applications",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

