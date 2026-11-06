"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Skip check for public auth pages
    if (pathname === "/login" || pathname === "/signup") {
      setIsChecking(false);
      return;
    }

    // Verify authentication
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/verify");
        const data = await response.json();

        if (!data.authenticated) {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }
      } catch (error) {
        console.error("Auth check error:", error);
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Show loading state while checking
  if (isChecking && pathname !== "/login" && pathname !== "/signup") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          <p className="mt-4 text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

