import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectDB from "@/lib/mongodb";
import { UserProfileModel } from "@/lib/models/UserProfile";
import { getSession } from "@/lib/auth";
import { SMTP_PRESETS } from "@/lib/constants/smtpPresets";
import type { SmtpConfigResponse } from "@/lib/types/userProfile";

export const dynamic = "force-dynamic";

interface ErrorResponse {
  error: string;
  details?: Record<string, string>;
}

// GET the logged-in account's SMTP config. The password is never sent back.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json<ErrorResponse>({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const profile = await UserProfileModel.findOne({ name: session.username }).lean();
    const smtp = profile?.smtp;

    const response: SmtpConfigResponse = {
      provider: smtp?.provider || "gmail",
      host: smtp?.host || "",
      port: smtp?.port || "",
      secure: smtp?.secure ?? true,
      user: smtp?.user || "",
      from: smtp?.from || "",
      hasPassword: !!smtp?.pass,
    };

    return NextResponse.json(response);
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching SMTP config:", err);
    return NextResponse.json<ErrorResponse>(
      { error: err.message || "Failed to fetch SMTP config" },
      { status: 500 }
    );
  }
}

const smtpSchema = z.object({
  provider: z.enum(["gmail", "outlook", "custom"]),
  host: z.string().trim().optional(),
  port: z.coerce.number().int().positive().optional(),
  secure: z.boolean().optional(),
  user: z.string().trim().min(1, "SMTP username/email is required"),
  pass: z.string().optional(), // blank = keep the existing password
  from: z.string().trim().optional(),
});

// PUT update the logged-in account's SMTP config
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json<ErrorResponse>({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = smtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ErrorResponse>(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors as Record<string, string> },
        { status: 400 }
      );
    }
    const data = parsed.data;

    await connectDB();
    const existing = await UserProfileModel.findOne({ name: session.username });

    const preset = data.provider === "custom" ? null : SMTP_PRESETS[data.provider];
    const host = preset?.host ?? data.host;
    const port = preset?.port ?? data.port;
    const secure = preset ? preset.secure : (data.secure ?? true);

    if (!host || !port) {
      return NextResponse.json<ErrorResponse>(
        { error: "Host and port are required for a custom SMTP server" },
        { status: 400 }
      );
    }

    const pass = data.pass && data.pass.length > 0 ? data.pass : existing?.smtp?.pass;
    if (!pass) {
      return NextResponse.json<ErrorResponse>(
        { error: "SMTP password (or app password) is required" },
        { status: 400 }
      );
    }

    const profile = await UserProfileModel.findOneAndUpdate(
      { name: session.username },
      {
        smtp: {
          provider: data.provider,
          host,
          port,
          secure,
          user: data.user,
          pass,
          from: data.from || data.user,
        },
      },
      { new: true, upsert: true }
    ).lean();

    const smtp = profile?.smtp;
    const response: SmtpConfigResponse = {
      provider: smtp?.provider || data.provider,
      host: smtp?.host || host,
      port: smtp?.port || port,
      secure: smtp?.secure ?? secure,
      user: smtp?.user || data.user,
      from: smtp?.from || data.from || data.user,
      hasPassword: !!smtp?.pass,
    };

    return NextResponse.json(response);
  } catch (error) {
    const err = error as Error;
    console.error("Error updating SMTP config:", err);
    return NextResponse.json<ErrorResponse>(
      { error: err.message || "Failed to update SMTP config" },
      { status: 500 }
    );
  }
}
