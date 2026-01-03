import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({ 
  schemaOptions: { 
    timestamps: true, 
    collection: "applications" 
  },
  options: {
    allowMixed: 0,
    customName: "Application",
  }
})
export class Application {
  @prop({ required: true })
  public name!: string;

  @prop({ required: true })
  public university!: string;

  @prop({ required: true })
  public email!: string;

  @prop({ required: true })
  public emailText!: string;

  @prop({ 
    required: true, 
    enum: ["pending", "sending", "sent", "error", "cancelled"],
    default: "pending"
  })
  public status!: "pending" | "sending" | "sent" | "error" | "cancelled";

  @prop({ required: false })
  public error?: string; // Summary error message for list view

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public errorDetails?: {
    message: string;
    payloadSize?: {
      emailBodySizeKB: number;
      totalAttachmentSizeMB: number;
      totalPayloadSizeMB: number;
      attachmentsCount: number;
      attachmentDetails?: Array<{
        filename: string;
        sizeMB: number;
        contentType?: string;
      }>;
    };
    timestamp?: string;
    httpStatus?: number;
    httpStatusText?: string;
    [key: string]: any; // Allow additional debug fields
  };

  @prop({ 
    required: false, 
    type: [String],
    default: []
  })
  public attachments?: string[]; // Array of attachment IDs
}

// Proper model initialization for Next.js with hot reloading
function getApplicationModel(): ReturnModelType<typeof Application, {}> {
  try {
    // Check if model already exists in mongoose registry
    if (mongoose.models.Application) {
      return mongoose.models.Application as ReturnModelType<typeof Application, {}>;
    }
    // Create new model with explicit name
    return getModelForClass(Application, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "applications" }
    });
  } catch (error) {
    // If model exists but compilation failed, return existing
    if (mongoose.models.Application) {
      return mongoose.models.Application as ReturnModelType<typeof Application, {}>;
    }
    throw error;
  }
}

export const ApplicationModel = getApplicationModel();

