export interface Attachment {
  filename: string;
  content: string; // base64 encoded
  contentType?: string;
}

/**
 * Convert a File to base64 encoded attachment
 */
export async function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64Content = result.split(',')[1] || result;
      resolve({
        filename: file.name,
        content: base64Content,
        contentType: file.type || undefined,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 attachment back to File-like object for download
 */
export function attachmentToDataUrl(attachment: Attachment): string {
  const contentType = attachment.contentType || 'application/octet-stream';
  return `data:${contentType};base64,${attachment.content}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Find dangling attachments (not referenced by any application or template), scoped to one account.
 * Verifies against actual applications and templates, not just stored reference fields
 * This ensures accuracy even if reference fields are out of sync
 */
export async function findDanglingAttachments(
  AttachmentModel: any,
  userId: string,
  /** Unified workspace model (`WorkspaceApplicationModel`) — all kinds share `attachments`. */
  WorkspaceApplicationModel: any,
  EmailTemplateModel?: any
): Promise<string[]> {
  // Get all attachment IDs owned by this account
  const allAttachments = await AttachmentModel.find({ userId }, '_id').lean();
  const allAttachmentIds = new Set(allAttachments.map((att: any) => att._id.toString()));

  // Get all attachment IDs referenced by this account's workspace applications (email + admission)
  const applications = await WorkspaceApplicationModel.find({ userId }, "attachments").lean();
  const referencedByApplications = new Set<string>();
  applications.forEach((app: any) => {
    if (app.attachments && Array.isArray(app.attachments)) {
      app.attachments.forEach((id: string) => {
        referencedByApplications.add(id.toString());
      });
    }
  });

  // Get all attachment IDs referenced by this account's template (one per account, keyed by username)
  const referencedByTemplates = new Set<string>();
  if (EmailTemplateModel) {
    const templates = await EmailTemplateModel.find({ name: userId }, 'attachments').lean();
    templates.forEach((template: any) => {
      if (template.attachments && Array.isArray(template.attachments)) {
        template.attachments.forEach((id: any) => {
          // Handle both string IDs and object IDs
          const idStr = typeof id === 'string' ? id : id.toString();
          if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
            referencedByTemplates.add(idStr);
          }
        });
      }
    });
  }

  // Find attachments that are not referenced by either applications or templates
  const danglingIds = Array.from(allAttachmentIds).filter((id): id is string => {
    return typeof id === 'string' && !referencedByApplications.has(id) && !referencedByTemplates.has(id);
  });

  return danglingIds;
}

/**
 * Delete dangling attachments, scoped to one account.
 */
export async function cleanupDanglingAttachments(
  AttachmentModel: any,
  userId: string,
  WorkspaceApplicationModel: any,
  EmailTemplateModel?: any
): Promise<{ deletedCount: number; deletedIds: string[] }> {
  const danglingIds = await findDanglingAttachments(
    AttachmentModel,
    userId,
    WorkspaceApplicationModel,
    EmailTemplateModel
  );

  if (danglingIds.length === 0) {
    return { deletedCount: 0, deletedIds: [] };
  }

  const result = await AttachmentModel.deleteMany({
    _id: { $in: danglingIds },
    userId,
  });

  return {
    deletedCount: result.deletedCount || 0,
    deletedIds: danglingIds
  };
}

/**
 * Find or create an attachment for one account, avoiding duplicates based on content.
 * Returns the attachment ID (existing or newly created)
 * Only creates a new attachment if one with the same content doesn't already exist for this account
 */
export async function findOrCreateAttachment(
  AttachmentModel: any,
  userId: string,
  attachmentData: {
    filename: string;
    content: string;
    contentType?: string;
    size?: number;
  }
): Promise<string> {
  // First, try to find an existing attachment with the same content, owned by this account.
  // Content is the unique identifier - same content = same file, regardless of filename
  // We check by content first (most important), then optionally by filename
  const existing = await AttachmentModel.findOne({
    content: attachmentData.content,
    userId,
  }).select('_id');

  if (existing) {
    // Attachment with this content already exists - reuse it
    // Note: We don't update the filename if it's different, as the content is the same
    return existing._id.toString();
  }

  // If not found, this is a truly new attachment - create it
  const newAttachment = await AttachmentModel.create({
    ...attachmentData,
    userId,
    referencedByApplications: [],
    referencedByTemplates: [],
  });
  return newAttachment._id.toString();
}

/**
 * Add a reference from an application to an attachment (scoped to the owning account)
 */
export async function addApplicationReference(
  AttachmentModel: any,
  userId: string,
  attachmentId: string,
  applicationId: string
): Promise<void> {
  await AttachmentModel.findOneAndUpdate(
    { _id: attachmentId, userId },
    {
      $addToSet: { referencedByApplications: applicationId }
    }
  );
}

/**
 * Remove a reference from an application to an attachment (scoped to the owning account)
 */
export async function removeApplicationReference(
  AttachmentModel: any,
  userId: string,
  attachmentId: string,
  applicationId: string
): Promise<void> {
  await AttachmentModel.findOneAndUpdate(
    { _id: attachmentId, userId },
    {
      $pull: { referencedByApplications: applicationId }
    }
  );
}

/**
 * Add a reference from a template to an attachment (scoped to the owning account)
 */
export async function addTemplateReference(
  AttachmentModel: any,
  userId: string,
  attachmentId: string,
  templateName: string
): Promise<void> {
  await AttachmentModel.findOneAndUpdate(
    { _id: attachmentId, userId },
    {
      $addToSet: { referencedByTemplates: templateName }
    }
  );
}

/**
 * Remove a reference from a template to an attachment (scoped to the owning account)
 */
export async function removeTemplateReference(
  AttachmentModel: any,
  userId: string,
  attachmentId: string,
  templateName: string
): Promise<void> {
  // Validate that attachmentId is a valid ObjectId string
  if (typeof attachmentId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(attachmentId.trim())) {
    console.warn(`[removeTemplateReference] Invalid attachment ID: ${attachmentId} (type: ${typeof attachmentId})`);
    return;
  }

  await AttachmentModel.findOneAndUpdate(
    { _id: attachmentId.trim(), userId },
    {
      $pull: { referencedByTemplates: templateName }
    }
  );
}

/**
 * Update all attachment references based on an application's attachment list (scoped to the owning account)
 */
export async function syncApplicationAttachmentReferences(
  AttachmentModel: any,
  userId: string,
  applicationId: string,
  oldAttachmentIds: string[],
  newAttachmentIds: string[]
): Promise<void> {
  const oldSet = new Set(oldAttachmentIds.map(id => id.toString()));
  const newSet = new Set(newAttachmentIds.map(id => id.toString()));

  // Find attachments to remove references from
  const toRemove = oldAttachmentIds.filter(id => !newSet.has(id.toString()));
  // Find attachments to add references to
  const toAdd = newAttachmentIds.filter(id => !oldSet.has(id.toString()));

  // Remove references
  for (const attachmentId of toRemove) {
    await removeApplicationReference(AttachmentModel, userId, attachmentId, applicationId);
  }

  // Add references
  for (const attachmentId of toAdd) {
    await addApplicationReference(AttachmentModel, userId, attachmentId, applicationId);
  }
}

/**
 * Update all attachment references based on a template's attachment list (scoped to the owning account)
 */
export async function syncTemplateAttachmentReferences(
  AttachmentModel: any,
  userId: string,
  templateName: string,
  oldAttachmentIds: string[],
  newAttachmentIds: string[]
): Promise<void> {
  // Filter out invalid IDs (objects, null, etc.) - only keep valid ObjectId strings
  const validOldIds = oldAttachmentIds.filter((id): id is string =>
    typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())
  );
  const validNewIds = newAttachmentIds.filter((id): id is string =>
    typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())
  );

  const oldSet = new Set(validOldIds.map(id => id.trim()));
  const newSet = new Set(validNewIds.map(id => id.trim()));

  // Find attachments to remove references from
  const toRemove = validOldIds.filter(id => !newSet.has(id.trim()));
  // Find attachments to add references to
  const toAdd = validNewIds.filter(id => !oldSet.has(id.trim()));

  // Remove references
  for (const attachmentId of toRemove) {
    await removeTemplateReference(AttachmentModel, userId, attachmentId, templateName);
  }

  // Add references
  for (const attachmentId of toAdd) {
    await addTemplateReference(AttachmentModel, userId, attachmentId, templateName);
  }
}

/**
 * Remove invalid attachment IDs from applications and templates, scoped to one account.
 * This cleans up dangling references where attachment IDs point to non-existent attachments
 */
export async function cleanupInvalidAttachmentReferences(
  AttachmentModel: any,
  userId: string,
  WorkspaceApplicationModel: any,
  EmailTemplateModel?: any
): Promise<{
  applicationsCleaned: number;
  templatesCleaned: number;
  removedIds: string[];
}> {
  // Get all valid attachment IDs owned by this account
  const allAttachments = await AttachmentModel.find({ userId }, '_id').lean();
  const validAttachmentIds = new Set(allAttachments.map((att: any) => att._id.toString()));

  let applicationsCleaned = 0;
  let templatesCleaned = 0;
  const removedIds: string[] = [];

  // Clean up this account's workspace applications (email + admission)
  const applications = await WorkspaceApplicationModel.find({
    userId,
    attachments: { $exists: true, $ne: [] },
  }).lean();
  for (const app of applications) {
    if (app.attachments && Array.isArray(app.attachments)) {
      const validIds = app.attachments.filter((id: any) => {
        const idStr = typeof id === 'string' ? id : id.toString();
        return validAttachmentIds.has(idStr);
      });

      if (validIds.length !== app.attachments.length) {
        // Some IDs were invalid, update the application
        const invalidIds = app.attachments.filter((id: any) => {
          const idStr = typeof id === 'string' ? id : id.toString();
          return !validAttachmentIds.has(idStr);
        }).map((id: any) => id.toString());

        removedIds.push(...invalidIds);
        await WorkspaceApplicationModel.updateOne(
          { _id: app._id, userId },
          { $set: { attachments: validIds } }
        );
        applicationsCleaned++;
      }
    }
  }

  // Clean up this account's template (one per account, keyed by username)
  if (EmailTemplateModel) {
    const templates = await EmailTemplateModel.find({ name: userId, attachments: { $exists: true, $ne: [] } }).lean();
    for (const template of templates) {
      if (template.attachments && Array.isArray(template.attachments)) {
        const validIds = template.attachments.filter((id: any) => {
          const idStr = typeof id === 'string' ? id : id.toString();
          return /^[0-9a-fA-F]{24}$/.test(idStr) && validAttachmentIds.has(idStr);
        });

        if (validIds.length !== template.attachments.length) {
          // Some IDs were invalid, update the template
          const invalidIds = template.attachments.filter((id: any) => {
            const idStr = typeof id === 'string' ? id : id.toString();
            return !(/^[0-9a-fA-F]{24}$/.test(idStr) && validAttachmentIds.has(idStr));
          }).map((id: any) => id.toString());

          removedIds.push(...invalidIds);
          // Use updateOne to bypass Mongoose casting issues
          await EmailTemplateModel.updateOne(
            { _id: template._id, name: userId },
            { $set: { attachments: validIds } }
          );
          templatesCleaned++;
        }
      }
    }
  }

  return {
    applicationsCleaned,
    templatesCleaned,
    removedIds: Array.from(new Set(removedIds)) // Remove duplicates
  };
}
