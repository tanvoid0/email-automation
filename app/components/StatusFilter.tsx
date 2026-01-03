"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ApplicationStatus = "pending" | "sending" | "sent" | "error" | "cancelled";

interface StatusFilterProps {
  statusFilter: Set<ApplicationStatus>;
  onToggleStatus: (status: ApplicationStatus) => void;
  onSelectAll: () => void;
  filteredCount?: number;
  totalCount?: number;
}

export function StatusFilter({
  statusFilter,
  onToggleStatus,
  onSelectAll,
  filteredCount,
  totalCount,
}: StatusFilterProps) {
  const allStatuses: ApplicationStatus[] = ["pending", "sending", "sent", "error", "cancelled"];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Filter by status</span>
          {statusFilter.size < 5 && filteredCount !== undefined && totalCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              Showing {filteredCount} of {totalCount}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            className={cn(
              "h-8 text-xs transition-all",
              statusFilter.size === 5 
                ? "bg-foreground text-background font-semibold hover:bg-foreground/90" 
                : "text-muted-foreground"
            )}
          >
            ALL
          </Button>
          <div className="h-6 w-px bg-border mx-1" />
          {allStatuses.map((status) => (
            <Button
              key={status}
              variant="outline"
              size="sm"
              onClick={() => onToggleStatus(status)}
              className={cn(
                "h-8 text-xs capitalize transition-all font-semibold",
                statusFilter.has(status)
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "text-muted-foreground bg-background hover:bg-muted"
              )}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

