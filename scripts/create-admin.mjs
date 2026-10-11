import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error(
    "MONGODB_URI is missing from environment variables",
  );
}

const adminSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["OWNER", "MANAGER", "STAFF"],
      default: "OWNER",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Admin =
  mongoose.models.Admin ||
  mongoose.model("Admin", adminSchema);

const rl = readline.createInterface({
  input,
  output,
});

try {
  const name = (
    await rl.question("Admin name: ")
  ).trim();

  const email = (
    await rl.question("Admin email: ")
  )
    .trim()
    .toLowerCase();

  const password = await rl.question(
    "Admin password: ",
  );

  if (!name || !email || !password) {
    throw new Error(
      "Name, email and password are required.",
    );
  }

  if (password.length < 8) {
    throw new Error(
      "Password must be at least 8 characters.",
    );
  }

  await mongoose.connect(mongoUri);

  const existing = await Admin.findOne({
    email,
  });

  if (existing) {
    console.log(
      "An admin with this email already exists.",
    );
    process.exit(0);
  }

  const passwordHash =
    await bcrypt.hash(password, 12);

  await Admin.create({
    name,
    email,
    passwordHash,
    role: "OWNER",
    isActive: true,
  });

  console.log(
    `Admin "${email}" created successfully.`,
  );
} finally {
  rl.close();

  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
}