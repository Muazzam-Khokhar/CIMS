import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVehicle {
  name: string;
  model?: string;
  color?: string;
  chassisNumber?: string;

  engineNumber?: string;
  registrationNumber?: string;
  mileage?: number;
  purchaseDate?: Date;
  purchasePrice?: number;
  location?: string;
  condition?: string;
  notes?: string;
  images: {
    url: string;
    publicId: string;
  }[];
  status: "AVAILABLE" | "SOLD" | "DISCARDED";

  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    model: {
      type: String,
      trim: true,
    },

    color: {
      type: String,
      trim: true,
    },

    chassisNumber: {
      type: String,
      trim: true,
      unique: true,
    },
    engineNumber: {
      type: String,
      trim: true,
    },

    registrationNumber: {
      type: String,
      trim: true,
    },

    mileage: {
      type: Number,
      min: 0,
    },

    purchaseDate: {
      type: Date,
      required: true,
    },

    purchasePrice: {
      type: Number,
      min: 0,
      required: true,
    },

    location: {
      type: String,
      trim: true,
    },

    condition: {
      type: String,
      trim: true,
    },

    notes: {
      type: String,
      trim: true,
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["AVAILABLE", "SOLD", "DISCARDED"],
      default: "AVAILABLE",
    },
  },
  {
    timestamps: true,
  }
);

const Vehicle: Model<IVehicle> =
  mongoose.models.Vehicle ||
  mongoose.model<IVehicle>("Vehicle", vehicleSchema);

export default Vehicle;