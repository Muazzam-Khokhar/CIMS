import mongoose, { Schema } from "mongoose";

const LoanSchema = new Schema(
  {
    direction: {
      type: String,
      enum: ["BUSINESS_BORROWED", "PARTNER_ADVANCE"],
      required: true,
    },

    counterpartyType: {
      type: String,
      enum: ["PARTNER", "BANK", "INDIVIDUAL", "OTHER"],
      required: true,
    },

    counterpartyName: {
      type: String,
      required: true,
      trim: true,
    },

    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },

    principalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    loanDate: {
      type: Date,
      required: true,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["ACTIVE", "SETTLED", "VOIDED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

LoanSchema.index({ direction: 1, status: 1 });
LoanSchema.index({ partnerId: 1, loanDate: -1 });
LoanSchema.index({ dueDate: 1, status: 1 });

const Loan =
  mongoose.models.Loan ||
  mongoose.model("Loan", LoanSchema);

export default Loan;