import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({ schemaOptions: { timestamps: true } })
export class Professor {
  @prop({ required: true })
  public name!: string;

  @prop({ required: true })
  public university!: string;

  @prop({ required: true, unique: true })
  public email!: string;

  @prop({ required: true })
  public emailText!: string;

  @prop({ 
    required: true, 
    enum: ["pending", "sending", "sent", "error"],
    default: "pending"
  })
  public status!: "pending" | "sending" | "sent" | "error";

  @prop({ required: false })
  public error?: string;
}

export const ProfessorModel = mongoose.models.Professor || getModelForClass(Professor);
