import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";
import mongoose from "mongoose";
import type { UserProfileData } from "@/lib/types/userProfile";

@modelOptions({ schemaOptions: { timestamps: true } })
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

export const UserProfileModel = mongoose.models.UserProfile || getModelForClass(UserProfile);

