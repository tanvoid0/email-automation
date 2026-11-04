import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { SopTemplateModel } from "@/lib/models/SopTemplate";
import { sopTemplateSchema } from "@/lib/validations/sopTemplate";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const templates = await SopTemplateModel.find({ userId: session.username })
      .sort({ updatedAt: -1 })
      .lean();
    return NextResponse.json(templates);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error fetching SOP templates:", errorMessage);
    return NextResponse.json(
      { error: errorMessage || "Failed to fetch templates" } as ApiErrorResponse,
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const validationResult = sopTemplateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const data = validationResult.data;
    const template = await SopTemplateModel.create({
      userId: session.username,
      name: data.name.trim(),
      description: data.description?.trim(),
      sections: data.sections.map((s) => ({
        key: s.key.trim(),
        label: s.label.trim(),
        placeholder: s.placeholder?.trim(),
        order: s.order,
      })),
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error creating SOP template:", errorMessage);
    return NextResponse.json(
      { error: errorMessage || "Failed to create template" } as ApiErrorResponse,
      { status: 500 }
    );
  }
}
