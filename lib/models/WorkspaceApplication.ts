import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";
import type {
  AdmissionChecklistItem,
  AdmissionContact,
  AdmissionDeadline,
  AdmissionDecision,
  AdmissionPriority,
  AdmissionStage,
} from "@/lib/types/admission";
import {
  WORKSPACE_KIND_ADMISSION,
  WORKSPACE_KIND_EMAIL,
  type WorkspaceApplicationKind,
} from "@/lib/constants/workspaceKind";

export type EmailOutreachStatus = "pending" | "sending" | "sent" | "error" | "cancelled";

/**
 * Single persisted aggregate for:
 * - Email outreach to a contact (professor, etc.) — `kind: email_outreach`
 * - University admission tracking — `kind: university_admission`
 *
 * Run `pnpm run migrate:workspace-applications` before using the app against an existing DB.
 */
@modelOptions({
  schemaOptions: {
    timestamps: true,
    collection: "workspace_applications",
  },
  options: {
    allowMixed: 1,
    customName: "WorkspaceApplication",
  },
})
export class WorkspaceApplication {
  @prop({
    required: true,
    enum: [WORKSPACE_KIND_EMAIL, WORKSPACE_KIND_ADMISSION],
    type: String,
  })
  public kind!: WorkspaceApplicationKind;

  // --- email_outreach (legacy Application) ---
  @prop({ required: false })
  public name?: string;

  @prop({ required: false })
  public university?: string;

  @prop({ required: false })
  public email?: string;

  @prop({ required: false })
  public emailText?: string;

  @prop({
    required: false,
    enum: ["pending", "sending", "sent", "error", "cancelled"],
  })
  public status?: EmailOutreachStatus;

  @prop({ required: false })
  public error?: string;

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public errorDetails?: Record<string, unknown>;

  @prop({ required: false })
  public lastAttemptId?: string;

  @prop({ required: false, default: 0 })
  public statusVersion?: number;

  // --- university_admission (legacy AdmissionApplication) ---
  @prop({ required: false })
  public universityName?: string;

  @prop({ required: false })
  public programName?: string;

  @prop({ required: false })
  public degree?: string;

  @prop({ required: false })
  public country?: string;

  @prop({ required: false })
  public term?: string;

  @prop({ required: false })
  public applicationUrl?: string;

  @prop({ required: false })
  public scholarshipUrl?: string;

  @prop({ required: false })
  public departmentUrl?: string;

  @prop({ required: false })
  public statusPortalUrl?: string;

  @prop({ required: false, type: mongoose.Schema.Types.ObjectId, ref: "SOP" })
  public sopId?: mongoose.Types.ObjectId;

  @prop({
    required: false,
    enum: [
      "researching",
      "in_progress",
      "ready_to_submit",
      "submitted",
      "under_review",
      "interview",
      "decision",
      "scholarship",
      "archived",
    ],
  })
  public stage?: AdmissionStage;

  @prop({ required: false, default: 0 })
  public sortOrder?: number;

  @prop({
    required: false,
    type: mongoose.Schema.Types.Mixed,
    default: [] as AdmissionChecklistItem[],
  })
  public checklist?: AdmissionChecklistItem[];

  @prop({
    required: false,
    type: mongoose.Schema.Types.Mixed,
    default: [] as AdmissionDeadline[],
  })
  public deadlines?: AdmissionDeadline[];

  @prop({
    required: false,
    type: mongoose.Schema.Types.Mixed,
    default: [] as AdmissionContact[],
  })
  public contacts?: AdmissionContact[];

  @prop({ required: false })
  public notes?: string;

  @prop({
    required: false,
    enum: ["low", "normal", "high"],
  })
  public priority?: AdmissionPriority;

  @prop({
    required: false,
    enum: ["unknown", "accepted", "rejected", "waitlist"],
  })
  public decision?: AdmissionDecision;

  /** Shared: attachment ObjectId strings */
  @prop({ required: false, type: [String], default: [] })
  public attachments?: string[];
}

function getWorkspaceApplicationModel(): ReturnModelType<typeof WorkspaceApplication, {}> {
  try {
    if (mongoose.models.WorkspaceApplication) {
      return mongoose.models.WorkspaceApplication as ReturnModelType<typeof WorkspaceApplication, {}>;
    }
    return getModelForClass(WorkspaceApplication, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "workspace_applications" },
    });
  } catch (error) {
    if (mongoose.models.WorkspaceApplication) {
      return mongoose.models.WorkspaceApplication as ReturnModelType<typeof WorkspaceApplication, {}>;
    }
    throw error;
  }
}

export const WorkspaceApplicationModel = getWorkspaceApplicationModel();

export { WORKSPACE_KIND_EMAIL, WORKSPACE_KIND_ADMISSION };
