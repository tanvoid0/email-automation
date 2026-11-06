import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthGuard } from "@/app/components/AuthGuard";
import { AppShell } from "@/app/components/AppShell";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants/app";

/** Vercel `vercel build` (Windows) can error with missing lambdas for static client-only pages; force server rendering. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
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
          <AppShell>{children}</AppShell>
        </AuthGuard>
        <Toaster />
      </body>
    </html>
  );
}
