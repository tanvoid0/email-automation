import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Parent route for detail/sub pages. Omit on tab roots (the nav covers them). */
  backHref?: string;
  backLabel?: string;
  /** Page-level actions. Wrap under the title on mobile, sit right on sm+. */
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, backLabel = "Back", actions }: PageHeaderProps) {
  return (
    <header className="space-y-3">
      {backHref && (
        <Link
          href={backHref}
          className="-ml-1 inline-flex h-8 items-center gap-0.5 rounded-md pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground md:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
      </div>
    </header>
  );
}
