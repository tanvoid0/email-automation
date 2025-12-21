import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { UserProfileModel } from "@/lib/models/UserProfile";
import type { UserProfileFormData } from "@/lib/types/userProfile";

export const dynamic = "force-dynamic";

interface ErrorResponse {
  error: string;
  details?: Record<string, string>;
}

// GET profile
export async function GET() {
  try {
    await connectDB();
    const profile = await UserProfileModel.findOne({ name: "default" });
    
    // Return empty profile if it doesn't exist (no defaults)
    if (!profile) {
      return NextResponse.json({
        fullName: "",
        email: "",
        degree: "",
        university: "",
        gpa: "",
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching profile:", err);
    return NextResponse.json<ErrorResponse>(
      { error: err.message || "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT update profile
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json() as UserProfileFormData;
    const { fullName, email, degree, university, gpa } = body;

    if (!fullName || !email) {
      return NextResponse.json<ErrorResponse>(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const profile = await UserProfileModel.findOneAndUpdate(
      { name: "default" },
      { fullName, email, degree, university, gpa },
      { new: true, upsert: true }
    );

    return NextResponse.json(profile);
  } catch (error) {
    const err = error as Error;
    console.error("Error updating profile:", err);
    return NextResponse.json<ErrorResponse>(
      { error: err.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}

