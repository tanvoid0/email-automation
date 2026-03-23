/**
 * Discriminator for unified {@link WorkspaceApplication} documents (one collection, two domains).
 */
export const WORKSPACE_KIND_EMAIL = "email_outreach" as const;
export const WORKSPACE_KIND_ADMISSION = "university_admission" as const;

export type WorkspaceApplicationKind =
  | typeof WORKSPACE_KIND_EMAIL
  | typeof WORKSPACE_KIND_ADMISSION;
