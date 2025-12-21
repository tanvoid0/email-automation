import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({ schemaOptions: { timestamps: true, collection: "attachments" } })
export class Attachment {
  @prop({ required: true })
  public filename!: string;

  @prop({ required: true })
  public content!: string; // base64 encoded

  @prop({ required: false })
  public contentType?: string;

  @prop({ required: false })
  public size?: number; // file size in bytes
}

export const AttachmentModel = mongoose.models.Attachment || getModelForClass(Attachment);

