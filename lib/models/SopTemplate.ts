import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";

export interface TemplateSection {
  key: string;
  label: string;
  placeholder?: string;
  order: number;
}

@modelOptions({
  schemaOptions: {
    timestamps: true,
    collection: "sop_templates",
  },
  options: {
    allowMixed: 1,
    customName: "SopTemplate",
  },
})
export class SopTemplate {
  @prop({ required: true })
  public name!: string;

  @prop({ required: false })
  public description?: string;

  @prop({
    required: true,
    type: mongoose.Schema.Types.Mixed,
    default: [] as TemplateSection[],
  })
  public sections!: TemplateSection[];
}

function getSopTemplateModel(): ReturnModelType<typeof SopTemplate, {}> {
  try {
    if (mongoose.models.SopTemplate) {
      return mongoose.models.SopTemplate as ReturnModelType<typeof SopTemplate, {}>;
    }
    return getModelForClass(SopTemplate, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "sop_templates" },
    });
  } catch (error) {
    if (mongoose.models.SopTemplate) {
      return mongoose.models.SopTemplate as ReturnModelType<typeof SopTemplate, {}>;
    }
    throw error;
  }
}

export const SopTemplateModel = getSopTemplateModel();
