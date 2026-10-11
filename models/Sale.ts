import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISale extends Document {
  vehicleId: mongoose.Types.ObjectId;
  saleType: "CUSTOMER" | "AUCTION";
  salePrice: number;
  saleDate: Date;
  status: "ACTIVE" | "RETURNED";
  returnDate?: Date;
  refundAmount?: number;
  returnReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const saleSchema = new Schema<ISale>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    saleType: {
      type: String,
      enum: ["CUSTOMER", "AUCTION"],
      required: true,
    },

    salePrice: {
      type: Number,
      required: true,
      min: 0.01,
    },

    saleDate: {
      type: Date,
      required: true,
    },
    status: { type: String, enum: ["ACTIVE", "RETURNED"], default: "ACTIVE" },
    returnDate: { type: Date },
    refundAmount: { type: Number, min: 0 },
    returnReason: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);
saleSchema.index(
  { vehicleId: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } },
);
const Sale: Model<ISale> =
  mongoose.models.Sale ||
  mongoose.model<ISale>("Sale", saleSchema);

export default Sale;