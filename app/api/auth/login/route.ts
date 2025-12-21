import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, createSession, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    if (!verifyCredentials(username, password)) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Create session
    const session = createSession(username);
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, session);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

