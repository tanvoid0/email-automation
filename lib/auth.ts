import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "auth_session";
const SESSION_DURATION_DAYS = 30;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface AuthSession {
  username: string;
  expiresAt: number;
}

/**
 * Creates a session cookie with 30-day expiration
 */
export function createSession(username: string): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const session: AuthSession = { username, expiresAt };
  return Buffer.from(JSON.stringify(session)).toString("base64");
}

/**
 * Validates and parses the session cookie
 */
export function parseSession(sessionCookie: string): AuthSession | null {
  try {
    const decoded = Buffer.from(sessionCookie, "base64").toString("utf-8");
    const session: AuthSession = JSON.parse(decoded);
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
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
  
  return parseSession(sessionCookie.value);
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

/**
 * Verifies username and password against environment variables
 */
export function verifyCredentials(
  username: string,
  password: string
): boolean {
  const envUsername = process.env.AUTH_USERNAME;
  const envPassword = process.env.AUTH_PASSWORD;
  
  if (!envUsername || !envPassword) {
    console.error("AUTH_USERNAME and AUTH_PASSWORD must be set in .env");
    return false;
  }
  
  return username === envUsername && password === envPassword;
}

