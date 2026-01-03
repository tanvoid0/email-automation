import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";

// Nested schema for template attachments
class TemplateAttachment {
  @prop({ required: true })
  public filename!: string;

  @prop({ required: true })
  public content!: string; // base64 encoded

  @prop({ required: false })
  public contentType?: string;
}

@modelOptions({ 
  schemaOptions: { 
    timestamps: true,
    collection: "emailtemplates"
  },
  options: {
    allowMixed: 0,
    customName: "EmailTemplate",
  }
})
export class EmailTemplate {
  @prop({ required: true, unique: true, default: "default" })
  public name!: string;

  @prop({ required: true })
  public content!: string;

  @prop({ required: false })
  public description?: string;

  @prop({ required: false })
  public subject?: string;

  // Store attachment IDs instead of embedded objects for better relationship tracking
  @prop({ 
    required: false, 
    type: [String],
    default: []
  })
  public attachments?: string[]; // Array of attachment IDs
}

// Proper model initialization for Next.js with hot reloading
function getEmailTemplateModel(): ReturnModelType<typeof EmailTemplate, {}> {
  try {
    // Check if model already exists in mongoose registry
    if (mongoose.models.EmailTemplate) {
      return mongoose.models.EmailTemplate as ReturnModelType<typeof EmailTemplate, {}>;
    }
    // Create new model with explicit name
    return getModelForClass(EmailTemplate, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "emailtemplates" }
    });
  } catch (error) {
    // If model exists but compilation failed, return existing
    if (mongoose.models.EmailTemplate) {
      return mongoose.models.EmailTemplate as ReturnModelType<typeof EmailTemplate, {}>;
    }
    throw error;
  }
}

export const EmailTemplateModel = getEmailTemplateModel();

