import mongoose, { Document, Schema } from "mongoose";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "DISCARD"
  | "SELL"
  | "PAYMENT_CREATE"
  | "LOGIN"
  | "LOGOUT"
  | "RETURN" 
  | "PAYMENT_UPDATE" 
  | "PAYMENT_DELETE";

export type AuditEntity =
  | "VEHICLE"
  | "VEHICLE_EXPENSE"
  | "SALE"
  | "PAYMENT"
  | "GENERAL_EXPENSE"
  | "PARTNER"
  | "LOAN"
  | "FINANCE_TRANSACTION"
  | "AUTH";

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId;
  actorName?: string;
  actorRole?: "OWNER" | "MANAGER" | "STAFF";

  action: AuditAction;
  entity: AuditEntity;
  entityId?: mongoose.Types.ObjectId;

  description: string;

  before?: Record<string, unknown>;
  after?: Record<string, unknown>;

  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },

    actorName: {
      type: String,
      trim: true,
    },

    actorRole: {
      type: String,
      enum: ["OWNER", "MANAGER", "STAFF"],
    },

    action: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "DISCARD",
        "SELL",
        "PAYMENT_CREATE",
        "LOGIN",
        "LOGOUT",
        "RETURN", 
        "PAYMENT_UPDATE",
        "PAYMENT_DELETE",
      ],
      required: true,
    },

    entity: {
      type: String,
      enum: [
        "VEHICLE",
        "VEHICLE_EXPENSE",
        "SALE",
        "PAYMENT",
        "GENERAL_EXPENSE",
        "PARTNER",
        "LOAN",
        "FINANCE_TRANSACTION",
        "AUTH",
      ],
      required: true,
    },

    entityId: {
      type: Schema.Types.ObjectId,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    before: {
      type: Schema.Types.Mixed,
    },

    after: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export default mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema);