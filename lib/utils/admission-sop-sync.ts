import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { SOPModel } from "@/lib/models/SOP";
import { WorkspaceApplicationModel, WORKSPACE_KIND_ADMISSION } from "@/lib/models/WorkspaceApplication";

/**
 * Keeps SOP.admissionApplicationId in sync with university_admission.sopId (one SOP ↔ one admission row).
 */
export async function syncAdmissionSopLink(
  admissionId: string,
  newSopId: string | undefined,
  previousSopId: string | undefined
): Promise<void> {
  await connectDB();
  const admissionOid = new mongoose.Types.ObjectId(admissionId);

  if (previousSopId && previousSopId !== newSopId) {
    await SOPModel.findOneAndUpdate(
      { _id: previousSopId, admissionApplicationId: admissionOid },
      { $unset: { admissionApplicationId: 1 } }
    );
  }

  if (!newSopId) {
    return;
  }

  await WorkspaceApplicationModel.updateMany(
    { kind: WORKSPACE_KIND_ADMISSION, sopId: newSopId, _id: { $ne: admissionOid } },
    { $unset: { sopId: 1 } }
  );

  await SOPModel.findByIdAndUpdate(newSopId, {
    admissionApplicationId: admissionOid,
  });
}

/**
 * When SOP.admissionApplicationId is edited, keep university_admission.sopId aligned.
 */
export async function syncSopAdmissionLink(
  sopId: string,
  newAdmissionId: string | undefined,
  previousAdmissionId: string | undefined
): Promise<void> {
  await connectDB();
  const sopOid = new mongoose.Types.ObjectId(sopId);

  if (previousAdmissionId && previousAdmissionId !== newAdmissionId) {
    await WorkspaceApplicationModel.findOneAndUpdate(
      {
        _id: previousAdmissionId,
        kind: WORKSPACE_KIND_ADMISSION,
        sopId: sopOid,
      },
      { $unset: { sopId: 1 } }
    );
  }

  if (!newAdmissionId) {
    return;
  }

  const admOid = new mongoose.Types.ObjectId(newAdmissionId);

  await SOPModel.updateMany(
    { admissionApplicationId: admOid, _id: { $ne: sopOid } },
    { $unset: { admissionApplicationId: 1 } }
  );

  await WorkspaceApplicationModel.findOneAndUpdate(
    { _id: newAdmissionId, kind: WORKSPACE_KIND_ADMISSION },
    { sopId: sopOid }
  );
}
