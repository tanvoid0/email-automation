import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { ApplicationModel } from "@/lib/models/Application";

export const dynamic = "force-dynamic";

// POST deduplicate attachments - merge duplicates and update references
export async function POST() {
  try {
    await connectDB();
    
    // Get all attachments with content (we need content for comparison)
    // Use allowDiskUse to handle large datasets
    const allAttachments = await AttachmentModel.find()
      .select('_id filename content contentType size')
      .lean()
      .allowDiskUse(true);
    
    // Group attachments by content (same content = duplicate)
    // Use a more efficient approach: process in batches if needed
    const contentMap = new Map<string, Array<{ _id: string; filename: string; contentType?: string; size?: number }>>();
    
    allAttachments.forEach((att: any) => {
      const contentKey = att.content;
      if (!contentMap.has(contentKey)) {
        contentMap.set(contentKey, []);
      }
      contentMap.get(contentKey)!.push({
        _id: att._id.toString(),
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
      });
    });
    
    // Find duplicates (groups with more than one attachment)
    const duplicates: Array<{ keep: string; remove: string[] }> = [];
    let totalDuplicates = 0;
    
    contentMap.forEach((attachments, content) => {
      if (attachments.length > 1) {
        // Keep the first one (oldest by ID, or we could sort by createdAt)
        const sorted = attachments.sort((a, b) => a._id.localeCompare(b._id));
        const keep = sorted[0]._id;
        const remove = sorted.slice(1).map(a => a._id);
        
        duplicates.push({ keep, remove });
        totalDuplicates += remove.length;
      }
    });
    
    // Update all applications to reference the kept attachment instead of duplicates
    let updatedApplications = 0;
    for (const { keep, remove } of duplicates) {
      // Find all applications that reference any of the duplicate attachments
      const applications = await ApplicationModel.find({
        attachments: { $in: remove }
      });
      
      for (const app of applications) {
        if (app.attachments && Array.isArray(app.attachments)) {
          let updated = false;
          const newAttachments = app.attachments.map((id: string) => {
            const idStr = id.toString();
            if (remove.includes(idStr)) {
              updated = true;
              return keep; // Replace duplicate with kept attachment
            }
            return idStr;
          });
          
          // Remove duplicates within the array
          const uniqueAttachments = Array.from(new Set(newAttachments));
          
          if (updated || newAttachments.length !== uniqueAttachments.length) {
            app.attachments = uniqueAttachments;
            app.markModified('attachments');
            await app.save();
            updatedApplications++;
          }
        }
      }
    }
    
    // Delete duplicate attachments
    const idsToDelete: string[] = [];
    duplicates.forEach(({ remove }) => {
      idsToDelete.push(...remove);
    });
    
    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const result = await AttachmentModel.deleteMany({
        _id: { $in: idsToDelete }
      });
      deletedCount = result.deletedCount || 0;
    }
    
    return NextResponse.json({
      message: "Deduplication completed",
      duplicateGroups: duplicates.length,
      totalDuplicates,
      deletedAttachments: deletedCount,
      updatedApplications,
    });
  } catch (error: any) {
    console.error("Error deduplicating attachments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to deduplicate attachments" },
      { status: 500 }
    );
  }
}

