import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 md:mb-4">404</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Page not found</p>
        <Button asChild className="mt-6">
          <Link href="/">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
