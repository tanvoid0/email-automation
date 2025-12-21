import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";
import mongoose from "mongoose";

class Attachment {
  @prop({ required: true })
  public filename!: string;

  @prop({ required: true })
  public content!: string; // base64 encoded

  @prop({ required: false })
  public contentType?: string;
}

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

  @prop({ 
    required: false, 
    type: () => [Attachment],
    default: []
  })
  public attachments?: Attachment[];
}

export const EmailTemplateModel = mongoose.models.EmailTemplate || getModelForClass(EmailTemplate);

