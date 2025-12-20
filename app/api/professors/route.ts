import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { ProfessorModel } from "@/lib/models/Professor";
import { professorSchema } from "@/lib/validations/professor";

export const dynamic = "force-dynamic";

// GET all professors
export async function GET() {
  try {
    await connectDB();
    const professors = await ProfessorModel.find().sort({ createdAt: -1 });
    return NextResponse.json(professors);
  } catch (error: any) {
    console.error("Error fetching professors:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch professors" },
      { status: 500 }
    );
  }
}

// POST create new professor
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    // Validate with Zod
    const validationResult = professorSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const professor = await ProfessorModel.create(validationResult.data);
    return NextResponse.json(professor, { status: 201 });
  } catch (error: any) {
    console.error("Error creating professor:", error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "A professor with this email already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create professor" },
      { status: 500 }
    );
  }
}

