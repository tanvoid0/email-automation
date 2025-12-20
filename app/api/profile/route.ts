import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { UserProfileModel } from "@/lib/models/UserProfile";

export const dynamic = "force-dynamic";

// GET profile
export async function GET() {
  try {
    await connectDB();
    let profile = await UserProfileModel.findOne({ name: "default" });
    
    if (!profile) {
      // Create default profile if it doesn't exist
      profile = await UserProfileModel.create({
        name: "default",
        yourName: "Nafisa Mubassira",
        yourEmail: "228801027@stu.yzu.edu.cn",
        yourDegree: "B.Sc. in Microelectronics Science and Engineering",
        yourUniversity: "Yangzhou University",
        yourGPA: "4.30/5.00",
      });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT update profile
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { yourName, yourEmail, yourDegree, yourUniversity, yourGPA } = body;

    if (!yourName || !yourEmail) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const profile = await UserProfileModel.findOneAndUpdate(
      { name: "default" },
      { yourName, yourEmail, yourDegree, yourUniversity, yourGPA },
      { new: true, upsert: true }
    );

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}

