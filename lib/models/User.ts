import { prop, getModelForClass, modelOptions, type ReturnModelType } from "@typegoose/typegoose";
import mongoose from "mongoose";

@modelOptions({
  schemaOptions: {
    timestamps: true,
    collection: "users",
  },
  options: {
    allowMixed: 0,
    customName: "User",
  },
})
export class User {
  @prop({ required: true, unique: true, trim: true, lowercase: true, index: true })
  public username!: string;

  @prop({ required: true })
  public passwordHash!: string;
}

function getUserModel(): ReturnModelType<typeof User, {}> {
  try {
    if (mongoose.models.User) {
      return mongoose.models.User as ReturnModelType<typeof User, {}>;
    }
    return getModelForClass(User, {
      existingMongoose: mongoose,
      schemaOptions: { collection: "users" },
    });
  } catch (error) {
    if (mongoose.models.User) {
      return mongoose.models.User as ReturnModelType<typeof User, {}>;
    }
    throw error;
  }
}

export const UserModel = getUserModel();
