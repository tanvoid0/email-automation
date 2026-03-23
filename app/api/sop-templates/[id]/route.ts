import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { SopTemplateModel } from "@/lib/models/SopTemplate";
import { sopTemplateUpdateSchema } from "@/lib/validations/sopTemplate";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const template = await SopTemplateModel.findById(id).lean();
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json(
      { error: errorMessage || "Failed to fetch template" } as ApiErrorResponse,
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const template = await SopTemplateModel.findById(id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const validationResult = sopTemplateUpdateSchema.safeParse(body);
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
    if (data.name !== undefined) template.name = data.name.trim();
    if (data.description !== undefined) template.description = data.description?.trim();
    if (data.sections !== undefined) {
      template.sections = data.sections.map((s) => ({
        key: s.key.trim(),
        label: s.label.trim(),
        placeholder: s.placeholder?.trim(),
        order: s.order,
      }));
    }
    await template.save();
    const updated = await SopTemplateModel.findById(id).lean();
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json(
      { error: errorMessage || "Failed to update template" } as ApiErrorResponse,
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const template = await SopTemplateModel.findByIdAndDelete(id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Template deleted successfully" });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json(
      { error: errorMessage || "Failed to delete template" } as ApiErrorResponse,
      { status: 500 }
    );
  }
}
