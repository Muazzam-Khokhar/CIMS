import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPayment extends Document {
  saleId: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMethod: "CASH" | "BANK" | "ONLINE" | "OTHER";
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    saleId: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK", "ONLINE", "OTHER"],
      required: true,
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Payment: Model<IPayment> =
  mongoose.models.Payment ||
  mongoose.model<IPayment>("Payment", paymentSchema);

export default Payment;