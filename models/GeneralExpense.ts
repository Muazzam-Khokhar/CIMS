import mongoose, { Schema, Document, Model } from "mongoose";

export interface IGeneralExpense extends Document {
  title: string;
  amount: number;
  expenseDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const generalExpenseSchema = new Schema<IGeneralExpense>(
  {
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
  { timestamps: true },
);

const GeneralExpense: Model<IGeneralExpense> =
  mongoose.models.GeneralExpense ||
  mongoose.model<IGeneralExpense>(
    "GeneralExpense",
    generalExpenseSchema,
  );

export default GeneralExpense;