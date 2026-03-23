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
 * Find dangling attachments (not referenced by any application or template)
 * Verifies against actual applications and templates, not just stored reference fields
 * This ensures accuracy even if reference fields are out of sync
 */
export async function findDanglingAttachments(
  AttachmentModel: any,
  /** Unified workspace model (`WorkspaceApplicationModel`) — all kinds share `attachments`. */
  WorkspaceApplicationModel: any,
  EmailTemplateModel?: any
): Promise<string[]> {
  // Get all attachment IDs
  const allAttachments = await AttachmentModel.find({}, '_id').lean();
  const allAttachmentIds = new Set(allAttachments.map((att: any) => att._id.toString()));

  // Get all attachment IDs referenced by workspace applications (email + admission)
  const applications = await WorkspaceApplicationModel.find({}, "attachments").lean();
  const referencedByApplications = new Set<string>();
  applications.forEach((app: any) => {
    if (app.attachments && Array.isArray(app.attachments)) {
      app.attachments.forEach((id: string) => {
        referencedByApplications.add(id.toString());
      });
    }
  });

  // Get all attachment IDs referenced by templates
  const referencedByTemplates = new Set<string>();
  if (EmailTemplateModel) {
    const templates = await EmailTemplateModel.find({}, 'attachments').lean();
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
 * Delete dangling attachments
 */
export async function cleanupDanglingAttachments(
  AttachmentModel: any,
  WorkspaceApplicationModel: any,
  EmailTemplateModel?: any
): Promise<{ deletedCount: number; deletedIds: string[] }> {
  const danglingIds = await findDanglingAttachments(
    AttachmentModel,
    WorkspaceApplicationModel,
    EmailTemplateModel
  );
  
  if (danglingIds.length === 0) {
    return { deletedCount: 0, deletedIds: [] };
  }

  const result = await AttachmentModel.deleteMany({
    _id: { $in: danglingIds }
  });

  return {
    deletedCount: result.deletedCount || 0,
    deletedIds: danglingIds
  };
}

/**
 * Find or create an attachment, avoiding duplicates based on content
 * Returns the attachment ID (existing or newly created)
 * Only creates a new attachment if one with the same content doesn't already exist
 */
export async function findOrCreateAttachment(
  AttachmentModel: any,
  attachmentData: {
    filename: string;
    content: string;
    contentType?: string;
    size?: number;
  }
): Promise<string> {
  // First, try to find an existing attachment with the same content
  // Content is the unique identifier - same content = same file, regardless of filename
  // We check by content first (most important), then optionally by filename
  const existing = await AttachmentModel.findOne({
    content: attachmentData.content,
  }).select('_id');

  if (existing) {
    // Attachment with this content already exists - reuse it
    // Note: We don't update the filename if it's different, as the content is the same
    return existing._id.toString();
  }

  // If not found, this is a truly new attachment - create it
  const newAttachment = await AttachmentModel.create({
    ...attachmentData,
    referencedByApplications: [],
    referencedByTemplates: [],
  });
  return newAttachment._id.toString();
}

/**
 * Add a reference from an application to an attachment
 */
export async function addApplicationReference(
  AttachmentModel: any,
  attachmentId: string,
  applicationId: string
): Promise<void> {
  await AttachmentModel.findByIdAndUpdate(
    attachmentId,
    {
      $addToSet: { referencedByApplications: applicationId }
    }
  );
}

/**
 * Remove a reference from an application to an attachment
 */
export async function removeApplicationReference(
  AttachmentModel: any,
  attachmentId: string,
  applicationId: string
): Promise<void> {
  await AttachmentModel.findByIdAndUpdate(
    attachmentId,
    {
      $pull: { referencedByApplications: applicationId }
    }
  );
}

/**
 * Add a reference from a template to an attachment
 */
export async function addTemplateReference(
  AttachmentModel: any,
  attachmentId: string,
  templateName: string = "default"
): Promise<void> {
  await AttachmentModel.findByIdAndUpdate(
    attachmentId,
    {
      $addToSet: { referencedByTemplates: templateName }
    }
  );
}

/**
 * Remove a reference from a template to an attachment
 */
export async function removeTemplateReference(
  AttachmentModel: any,
  attachmentId: string,
  templateName: string = "default"
): Promise<void> {
  // Validate that attachmentId is a valid ObjectId string
  if (typeof attachmentId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(attachmentId.trim())) {
    console.warn(`[removeTemplateReference] Invalid attachment ID: ${attachmentId} (type: ${typeof attachmentId})`);
    return;
  }

  await AttachmentModel.findByIdAndUpdate(
    attachmentId.trim(),
    {
      $pull: { referencedByTemplates: templateName }
    }
  );
}

/**
 * Update all attachment references based on an application's attachment list
 */
export async function syncApplicationAttachmentReferences(
  AttachmentModel: any,
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
    await removeApplicationReference(AttachmentModel, attachmentId, applicationId);
  }

  // Add references
  for (const attachmentId of toAdd) {
    await addApplicationReference(AttachmentModel, attachmentId, applicationId);
  }
}

/**
 * Update all attachment references based on a template's attachment list
 */
export async function syncTemplateAttachmentReferences(
  AttachmentModel: any,
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
    await removeTemplateReference(AttachmentModel, attachmentId, templateName);
  }

  // Add references
  for (const attachmentId of toAdd) {
    await addTemplateReference(AttachmentModel, attachmentId, templateName);
  }
}

/**
 * Remove invalid attachment IDs from applications and templates
 * This cleans up dangling references where attachment IDs point to non-existent attachments
 */
export async function cleanupInvalidAttachmentReferences(
  AttachmentModel: any,
  WorkspaceApplicationModel: any,
  EmailTemplateModel?: any
): Promise<{
  applicationsCleaned: number;
  templatesCleaned: number;
  removedIds: string[];
}> {
  // Get all valid attachment IDs
  const allAttachments = await AttachmentModel.find({}, '_id').lean();
  const validAttachmentIds = new Set(allAttachments.map((att: any) => att._id.toString()));

  let applicationsCleaned = 0;
  let templatesCleaned = 0;
  const removedIds: string[] = [];

  // Clean up workspace applications (email + admission)
  const applications = await WorkspaceApplicationModel.find({
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
        await WorkspaceApplicationModel.findByIdAndUpdate(app._id, {
          $set: { attachments: validIds }
        });
        applicationsCleaned++;
      }
    }
  }

  // Clean up templates
  if (EmailTemplateModel) {
    const templates = await EmailTemplateModel.find({ attachments: { $exists: true, $ne: [] } }).lean();
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
            { _id: template._id },
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

