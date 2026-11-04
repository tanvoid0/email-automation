import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";
import type { UserProfileData } from "@/lib/types/userProfile";
import type { SmtpProvider } from "@/lib/constants/smtpPresets";

class SmtpConfig {
  @prop({ required: true, enum: ["gmail", "outlook", "custom"], default: "gmail" })
  public provider!: SmtpProvider;

  @prop({ required: false })
  public host?: string;

  @prop({ required: false })
  public port?: number;

  @prop({ required: false, default: true })
  public secure?: boolean;

  @prop({ required: false })
  public user?: string;

  @prop({ required: false })
  public pass?: string;

  @prop({ required: false })
  public from?: string;
}

@modelOptions({
  schemaOptions: {
    timestamps: true,
    collection: "userprofiles"
  },
  options: {
    allowMixed: 0,
    customName: "UserProfile",
  }
})
export class UserProfile implements UserProfileData {
  // The owning account's username (1:1 with User.username)
  @prop({ required: true, unique: true })
  public name!: string;

  @prop({ required: false, default: "" })
  public fullName!: string;

  @prop({ required: false, default: "" })
  public email!: string;

  @prop({ required: false })
  public degree?: string;

  @prop({ required: false })
  public university?: string;

  @prop({ required: false })
  public gpa?: string;

  @prop({ required: false, type: () => SmtpConfig, _id: false })
  public smtp?: SmtpConfig;
}

// Proper model initialization for Next.js with hot reloading
function getUserProfileModel(): ReturnModelType<typeof UserProfile, {}> {
  try {
    // Check if model already exists in mongoose registry
    if (mongoose.models.UserProfile) {
      return mongoose.models.UserProfile as ReturnModelType<typeof UserProfile, {}>;
    }
    // Create new model with explicit name
    return getModelForClass(UserProfile, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "userprofiles" }
    });
  } catch (error) {
    // If model exists but compilation failed, return existing
    if (mongoose.models.UserProfile) {
      return mongoose.models.UserProfile as ReturnModelType<typeof UserProfile, {}>;
    }
    throw error;
  }
}

export const UserProfileModel = getUserProfileModel();
