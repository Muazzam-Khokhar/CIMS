import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISale extends Document {
  vehicleId: mongoose.Types.ObjectId;
  saleType: "CUSTOMER" | "AUCTION";
  salePrice: number;
  saleDate: Date;

  createdAt: Date;
  updatedAt: Date;
}

const saleSchema = new Schema<ISale>(
  {
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      unique:true,
    },

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
  },
  {
    timestamps: true,
  }
);

const Sale: Model<ISale> =
  mongoose.models.Sale ||
  mongoose.model<ISale>("Sale", saleSchema);

export default Sale;