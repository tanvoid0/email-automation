import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({ 
  schemaOptions: { 
    timestamps: true, 
    collection: "notifications" 
  },
  options: {
    allowMixed: 0,
    customName: "Notification",
  }
})
export class Notification {
  @prop({ required: true })
  public userId!: string; // username from session

  @prop({ 
    required: true,
    enum: ["success", "error", "warning", "info"],
    default: "info"
  })
  public type!: "success" | "error" | "warning" | "info";

  @prop({ required: true })
  public title!: string;

  @prop({ required: true })
  public message!: string;

  @prop({ required: false, default: false })
  public read?: boolean;

  @prop({ required: false })
  public readAt?: Date;

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public metadata?: {
    // For email operations
    applicationId?: string;
    emailAttemptedAt?: Date;
    emailSucceededAt?: Date;
    emailFailedAt?: Date;
    errorMessage?: string;
    
    // For bulk operations
    bulkId?: string;
    bulkType?: string;
    totalCount?: number;
    successCount?: number;
    failureCount?: number;
    groupedFailures?: Array<{
      error: string;
      count: number;
      applicationIds: string[];
      applicationNames: string[];
    }>;
    
    // For other operations
    [key: string]: any;
  };
}

// Proper model initialization for Next.js with hot reloading
function getNotificationModel(): ReturnModelType<typeof Notification, {}> {
  try {
    // Check if model already exists in mongoose registry
    if (mongoose.models.Notification) {
      return mongoose.models.Notification as ReturnModelType<typeof Notification, {}>;
    }
    // Create new model with explicit name
    return getModelForClass(Notification, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "notifications" }
    });
  } catch (error) {
    // If model exists but compilation failed, return existing
    if (mongoose.models.Notification) {
      return mongoose.models.Notification as ReturnModelType<typeof Notification, {}>;
    }
    throw error;
  }
}

export const NotificationModel = getNotificationModel();

