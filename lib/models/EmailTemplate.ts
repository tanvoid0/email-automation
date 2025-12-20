import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({ schemaOptions: { timestamps: true } })
export class EmailTemplate {
  @prop({ required: true, unique: true, default: "default" })
  public name!: string;

  @prop({ required: true })
  public content!: string;

  @prop({ required: false })
  public description?: string;

  @prop({ required: false })
  public subject?: string;
}

export const EmailTemplateModel = mongoose.models.EmailTemplate || getModelForClass(EmailTemplate);

