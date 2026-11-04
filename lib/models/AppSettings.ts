import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({
  schemaOptions: {
    timestamps: true,
    collection: "app_settings",
  },
  options: {
    allowMixed: 0,
    customName: "AppSettings",
  },
})
export class AppSettings {
  // Owning account's username — one settings doc per account (reuses the old "default" singleton key)
  @prop({ required: true, unique: true })
  public key!: string;

  /** e.g. Graduate (Master's/PhD), Undergraduate */
  @prop({ required: false })
  public admissionLevel?: string;

  /** Broad field / discipline for AI context, e.g. Computer Science */
  @prop({ required: false })
  public admissionSubjectArea?: string;
}

function getAppSettingsModel(): ReturnModelType<typeof AppSettings, {}> {
  try {
    if (mongoose.models.AppSettings) {
      return mongoose.models.AppSettings as ReturnModelType<typeof AppSettings, {}>;
    }
    return getModelForClass(AppSettings, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "app_settings" },
    });
  } catch (error) {
    if (mongoose.models.AppSettings) {
      return mongoose.models.AppSettings as ReturnModelType<typeof AppSettings, {}>;
    }
    throw error;
  }
}

export const AppSettingsModel = getAppSettingsModel();
