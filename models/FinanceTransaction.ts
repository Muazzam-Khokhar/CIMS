import mongoose, { Schema } from "mongoose";

const FinanceTransactionSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "PARTNER_CONTRIBUTION",
        "PARTNER_CAPITAL_RETURN",
        "PARTNER_DRAWING",

        "LOAN_RECEIVED",
        "LOAN_PRINCIPAL_REPAYMENT",

        "PARTNER_ADVANCE_GIVEN",
        "PARTNER_ADVANCE_REPAID",

        "BUSINESS_ADVANCE_GIVEN",
        "BUSINESS_ADVANCE_SETTLED",
      ],
      required: true,
    },

    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },

    loanId: {
      type: Schema.Types.ObjectId,
      ref: "Loan",
      default: null,
    },

    relatedTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "FinanceTransaction",
      default: null,
    },

    settlementType: {
      type: String,
      enum: ["EXPENSE", "CASH_RETURN"],
      default: null,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    transactionDate: {
      type: Date,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK", "ONLINE", "OTHER"],
      default: "CASH",
    },

    reference: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["VALID", "VOIDED"],
      default: "VALID",
    },

    voidReason: {
      type: String,
      trim: true,
      default: "",
    },

    voidedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

FinanceTransactionSchema.index({
  transactionDate: -1,
  createdAt: -1,
});

FinanceTransactionSchema.index({
  partnerId: 1,
  transactionDate: -1,
});

FinanceTransactionSchema.index({
  loanId: 1,
  transactionDate: -1,
});

FinanceTransactionSchema.index({
  relatedTransactionId: 1,
});

FinanceTransactionSchema.index({
  status: 1,
  type: 1,
});

const FinanceTransaction =
  mongoose.models.FinanceTransaction ||
  mongoose.model(
    "FinanceTransaction",
    FinanceTransactionSchema,
  );

export default FinanceTransaction;