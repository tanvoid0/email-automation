import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({ schemaOptions: { timestamps: true } })
export class UserProfile {
  @prop({ required: true, unique: true, default: "default" })
  public name!: string;

  @prop({ required: true })
  public yourName!: string;

  @prop({ required: true })
  public yourEmail!: string;

  @prop({ required: false })
  public yourDegree?: string;

  @prop({ required: false })
  public yourUniversity?: string;

  @prop({ required: false })
  public yourGPA?: string;
}

export const UserProfileModel = mongoose.models.UserProfile || getModelForClass(UserProfile);

