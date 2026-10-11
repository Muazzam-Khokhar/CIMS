import mongoose, {
    Document,
    Model,
    Schema,
  } from "mongoose";
  
  export type AdminRole =
    | "OWNER"
    | "MANAGER"
    | "STAFF";
  
  export interface IAdmin extends Document {
    name: string;
    email: string;
    passwordHash: string;
    role: AdminRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
  
  const adminSchema = new Schema<IAdmin>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },
  
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        index: true,
      },
  
      passwordHash: {
        type: String,
        required: true,
      },
  
      role: {
        type: String,
        enum: ["OWNER", "MANAGER", "STAFF"],
        default: "OWNER",
      },
  
      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },
    },
    {
      timestamps: true,
    },
  );
  
  const Admin: Model<IAdmin> =
    mongoose.models.Admin ||
    mongoose.model<IAdmin>("Admin", adminSchema);
  
  export default Admin;