import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { signSession, verifySession, type AuthSession } from "@/lib/session-token";

export type { AuthSession };

const SESSION_COOKIE_NAME = "auth_session";
const SESSION_DURATION_DAYS = 30;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Creates a signed session token with 30-day expiration
 */
export function createSession(username: string): Promise<string> {
  return signSession({ username, expiresAt: Date.now() + SESSION_DURATION_MS });
}

/**
 * Gets the current session from cookies (server-side)
 */
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  return verifySession(sessionCookie.value);
}

/**
 * Sets the session cookie in the response
 */
export function setSessionCookie(response: NextResponse, session: string): void {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  response.cookies.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/**
 * Clears the session cookie
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE_NAME);
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Verifies username and password against the users collection
 */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  await connectDB();
  const user = await UserModel.findOne({ username: normalizeUsername(username) });
  if (!user) {
    return false;
  }
  return bcrypt.compare(password, user.passwordHash);
}

/**
 * Creates a new account. Returns the normalized username on success.
 */
export async function createUser(
  username: string,
  password: string
): Promise<{ success: boolean; username?: string; error?: string }> {
  await connectDB();
  const normalized = normalizeUsername(username);

  const existing = await UserModel.findOne({ username: normalized });
  if (existing) {
    return { success: false, error: "That username is already taken" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await UserModel.create({ username: normalized, passwordHash });

  return { success: true, username: normalized };
}

