import mongoose, { Schema } from "mongoose";

const PartnerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    }
  },
  { timestamps: true },
);

PartnerSchema.index({ name: 1 });

const Partner =
  mongoose.models.Partner ||
  mongoose.model("Partner", PartnerSchema);

export default Partner;