import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthGuard } from "@/app/components/AuthGuard";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants/app";

/** Vercel `vercel build` (Windows) can error with missing lambdas for static client-only pages; force server rendering. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthGuard>
          {children}
        </AuthGuard>
        <Toaster />
      </body>
    </html>
  );
}

