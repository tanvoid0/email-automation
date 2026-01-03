import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({ 
  schemaOptions: { 
    timestamps: true, 
    collection: "attachments" 
  },
  options: {
    allowMixed: 0,
    customName: "Attachment",
  }
})
export class Attachment {
  @prop({ required: true })
  public filename!: string;

  @prop({ required: true })
  public content!: string; // base64 encoded

  @prop({ required: false })
  public contentType?: string;

  @prop({ required: false })
  public size?: number; // file size in bytes

  // Reference tracking - which applications use this attachment
  @prop({ 
    required: false, 
    type: [String],
    default: []
  })
  public referencedByApplications?: string[]; // Array of application IDs

  // Reference tracking - which templates use this attachment
  @prop({ 
    required: false, 
    type: [String],
    default: []
  })
  public referencedByTemplates?: string[]; // Array of template names (usually just "default")
}

// Proper model initialization for Next.js with hot reloading
function getAttachmentModel(): ReturnModelType<typeof Attachment, {}> {
  try {
    // Check if model already exists in mongoose registry
    if (mongoose.models.Attachment) {
      return mongoose.models.Attachment as ReturnModelType<typeof Attachment, {}>;
    }
    // Create new model with explicit name
    return getModelForClass(Attachment, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "attachments" }
    });
  } catch (error) {
    // If model exists but compilation failed, return existing
    if (mongoose.models.Attachment) {
      return mongoose.models.Attachment as ReturnModelType<typeof Attachment, {}>;
    }
    throw error;
  }
}

export const AttachmentModel = getAttachmentModel();

