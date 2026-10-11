import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVehicleExpense extends Document {
  vehicleId: mongoose.Types.ObjectId;
  title: string;
  amount: number;
  expenseDate: Date;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const vehicleExpenseSchema = new Schema<IVehicleExpense>(
  {
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    expenseDate: {
      type: Date,
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

const VehicleExpense: Model<IVehicleExpense> =
  mongoose.models.VehicleExpense ||
  mongoose.model<IVehicleExpense>("VehicleExpense", vehicleExpenseSchema);

export default VehicleExpense;