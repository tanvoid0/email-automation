import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { ProfessorModel } from "@/lib/models/Professor";

export const dynamic = "force-dynamic";

// GET single professor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const professor = await ProfessorModel.findById(id);
    
    if (!professor) {
      return NextResponse.json(
        { error: "Professor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(professor);
  } catch (error: any) {
    console.error("Error fetching professor:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch professor" },
      { status: 500 }
    );
  }
}

// PATCH update professor
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const professor = await ProfessorModel.findByIdAndUpdate(
      id,
      body,
      { new: true, runValidators: true }
    );

    if (!professor) {
      return NextResponse.json(
        { error: "Professor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(professor);
  } catch (error: any) {
    console.error("Error updating professor:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update professor" },
      { status: 500 }
    );
  }
}

// DELETE professor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const professor = await ProfessorModel.findByIdAndDelete(id);

    if (!professor) {
      return NextResponse.json(
        { error: "Professor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Professor deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting professor:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete professor" },
      { status: 500 }
    );
  }
}

