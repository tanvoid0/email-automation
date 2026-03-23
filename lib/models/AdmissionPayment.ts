import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";
import type { AdmissionPaymentStatus } from "@/lib/types/admissionPayment";

@modelOptions({
  schemaOptions: {
    timestamps: true,
    collection: "admission_payments",
  },
  options: {
    allowMixed: 0,
    customName: "AdmissionPayment",
  },
})
export class AdmissionPayment {
  @prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceApplication", index: true })
  public workspaceApplicationId!: mongoose.Types.ObjectId;

  @prop({ required: true, default: "Application fee" })
  public label!: string;

  @prop({ required: false })
  public amountText?: string;

  @prop({ required: false })
  public amountValue?: number;

  @prop({ required: false })
  public currency?: string;

  @prop({ required: false })
  public paymentUrl?: string;

  @prop({ required: false })
  public note?: string;

  @prop({
    required: true,
    enum: ["pending", "paid", "waived"],
    default: "pending",
  })
  public status!: AdmissionPaymentStatus;

  @prop({ required: false, type: Date })
  public paidAt?: Date;
}

function getAdmissionPaymentModel(): ReturnModelType<typeof AdmissionPayment, {}> {
  try {
    if (mongoose.models.AdmissionPayment) {
      return mongoose.models.AdmissionPayment as ReturnModelType<typeof AdmissionPayment, {}>;
    }
    return getModelForClass(AdmissionPayment, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "admission_payments" },
    });
  } catch (error) {
    if (mongoose.models.AdmissionPayment) {
      return mongoose.models.AdmissionPayment as ReturnModelType<typeof AdmissionPayment, {}>;
    }
    throw error;
  }
}

export const AdmissionPaymentModel = getAdmissionPaymentModel();
