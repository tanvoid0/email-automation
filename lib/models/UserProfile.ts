import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";
import type { UserProfileData } from "@/lib/types/userProfile";

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
  @prop({ required: true, unique: true, default: "default" })
  public name!: string;

  @prop({ required: true })
  public fullName!: string;

  @prop({ required: true })
  public email!: string;

  @prop({ required: false })
  public degree?: string;

  @prop({ required: false })
  public university?: string;

  @prop({ required: false })
  public gpa?: string;
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

