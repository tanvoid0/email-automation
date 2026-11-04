import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, dashes and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = signupSchema.parse(body);

    const result = await createUser(username, password);
    if (!result.success || !result.username) {
      return NextResponse.json(
        { error: result.error || "Could not create account" },
        { status: 409 }
      );
    }

    const session = createSession(result.username);
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, session);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
