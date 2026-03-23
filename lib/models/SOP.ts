import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";

export interface SOPSectionEntry {
  key: string;
  content: string;
}

@modelOptions({
  schemaOptions: {
    timestamps: true,
    collection: "sops",
  },
  options: {
    allowMixed: 1,
    customName: "SOP",
  },
})
export class SOP {
  @prop({ required: true })
  public title!: string;

  @prop({ required: true })
  public content!: string;

  @prop({ required: false, type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceApplication" })
  public applicationId?: mongoose.Types.ObjectId;

  @prop({ required: false, type: mongoose.Schema.Types.ObjectId, ref: "SopTemplate" })
  public templateId?: mongoose.Types.ObjectId;

  @prop({ required: false, type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceApplication" })
  public admissionApplicationId?: mongoose.Types.ObjectId;

  @prop({
    required: false,
    type: mongoose.Schema.Types.Mixed,
    default: [] as SOPSectionEntry[],
  })
  public sections?: SOPSectionEntry[];
}

function getSOPModel(): ReturnModelType<typeof SOP, {}> {
  try {
    if (mongoose.models.SOP) {
      return mongoose.models.SOP as ReturnModelType<typeof SOP, {}>;
    }
    return getModelForClass(SOP, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "sops" },
    });
  } catch (error) {
    if (mongoose.models.SOP) {
      return mongoose.models.SOP as ReturnModelType<typeof SOP, {}>;
    }
    throw error;
  }
}

export const SOPModel = getSOPModel();
