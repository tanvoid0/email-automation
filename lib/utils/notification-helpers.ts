/**
 * Client-safe notification utility functions
 * These functions don't import any server-side dependencies
 */

/**
 * Group failures by error message for bulk operations
 */
export function groupFailuresByError(
  failures: Array<{ applicationId: string; applicationName: string; error: string }>
): Array<{
  error: string;
  count: number;
  applicationIds: string[];
  applicationNames: string[];
}> {
  const grouped = new Map<string, {
    error: string;
    applicationIds: string[];
    applicationNames: string[];
  }>();

  for (const failure of failures) {
    const errorKey = failure.error || "Unknown error";
    if (!grouped.has(errorKey)) {
      grouped.set(errorKey, {
        error: errorKey,
        applicationIds: [],
        applicationNames: [],
      });
    }
    const group = grouped.get(errorKey)!;
    group.applicationIds.push(failure.applicationId);
    group.applicationNames.push(failure.applicationName);
  }

  return Array.from(grouped.values()).map(group => ({
    ...group,
    count: group.applicationIds.length,
  }));
}

