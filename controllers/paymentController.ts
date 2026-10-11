import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Sale from "@/models/Sale";
import Payment from "@/models/Payment";
import mongoose from "mongoose";
import { createAuditLog } from "@/lib/audit";
import {
  isValidDate,
  isValidObjectId,
  isValidPositiveNumber,
} from "@/lib/validation";
import { getPaginationParams } from "@/lib/pagination";

type AuditActor = {
  userId: string;
  name: string;
  role: "OWNER" | "MANAGER" | "STAFF";
};

export async function createPayment(
  data: {
    saleId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: "CASH" | "BANK" | "ONLINE" | "OTHER";
    notes?: string;
  },
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!isValidObjectId(data.saleId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sale ID",
        },
        { status: 400 },
      );
    }

    if (!isValidPositiveNumber(data.amount)) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment amount must be greater than 0",
        },
        { status: 400 },
      );
    }

    if (!isValidDate(data.paymentDate)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid payment date is required",
        },
        { status: 400 },
      );
    }

    const validMethods = ["CASH", "BANK", "ONLINE", "OTHER"];

    if (!validMethods.includes(data.paymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment method",
        },
        { status: 400 },
      );
    }

    let createdPayment;

    await session.withTransaction(async () => {
      const sale = await Sale.findById(data.saleId).session(session);

      if (!sale) {
        throw new Error("SALE_NOT_FOUND");
      }

      const existingPayments = await Payment.find({
        saleId: data.saleId,
      })
        .session(session)
        .lean();

      const totalPaid = existingPayments.reduce(
        (total, payment) => total + payment.amount,
        0,
      );

      const remaining = sale.salePrice - totalPaid;

      if (data.amount > remaining) {
        throw new Error(`PAYMENT_EXCEEDS_REMAINING:${remaining}`);
      }
      sale.updatedAt = new Date();
      await sale.save({ session });

      const payments = await Payment.create(
        [
          {
            saleId: data.saleId,
            amount: data.amount,
            paymentDate: new Date(data.paymentDate),
            paymentMethod: data.paymentMethod,
            notes: data.notes?.trim() || undefined,
          },
        ],
        { session },
      );

      createdPayment = payments[0];

      await createAuditLog({
        actor,
        action: "PAYMENT_CREATE",
        entity: "PAYMENT",
        entityId: createdPayment._id.toString(),
        description: `Payment of ${data.amount} added to sale ${data.saleId}`,
        after: {
          saleId: data.saleId,
          amount: data.amount,
          paymentDate: data.paymentDate,
          paymentMethod: data.paymentMethod,
          notes: data.notes?.trim() || undefined,
        },
        session,
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Payment added successfully",
        data: createdPayment,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SALE_NOT_FOUND") {
        return NextResponse.json(
          {
            success: false,
            message: "Sale not found",
          },
          { status: 404 },
        );
      }

      if (error.message.startsWith("PAYMENT_EXCEEDS_REMAINING:")) {
        const remaining = error.message.split(":")[1];

        return NextResponse.json(
          {
            success: false,
            message: `Payment cannot exceed remaining amount of ${remaining}`,
          },
          { status: 400 },
        );
      }
    }

    console.error("Create payment error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create payment",
      },
      { status: 500 },
    );
  } finally {
    await session.endSession();
  }
}
export async function getPayments(searchParams: URLSearchParams) {
  try {
    await connectDB();

    const { page, limit, skip } = getPaginationParams(searchParams);
    const method = searchParams.get("paymentMethod") || "ALL";
    const search = searchParams.get("search")?.trim() || "";

    const validMethods = ["CASH", "BANK", "ONLINE", "OTHER"];

    if (method !== "ALL" && !validMethods.includes(method)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment method" },
        { status: 400 },
      );
    }

    const filter: Record<string, unknown> = {};

    if (method !== "ALL") {
      filter.paymentMethod = method;
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchingVehicles = await mongoose
        .model("Vehicle")
        .find({
          $or: [
            { name: { $regex: escapedSearch, $options: "i" } },
            { model: { $regex: escapedSearch, $options: "i" } },
            { chassisNumber: { $regex: escapedSearch, $options: "i" } },
          ],
        })
        .distinct("_id");

      const matchingSales = await Sale.find({
        $or: [
          { vehicleId: { $in: matchingVehicles } },
          ...(mongoose.isValidObjectId(search) ? [{ _id: search }] : []),
        ],
      }).distinct("_id");

      filter.saleId = { $in: matchingSales };
    }

    const [payments, totalCount, totals] = await Promise.all([
      Payment.find(filter)
        .populate({
          path: "saleId",
          select: "vehicleId saleType salePrice saleDate",
          populate: {
            path: "vehicleId",
            select: "name model year chassisNumber",
          },
        })
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Payment.countDocuments(filter),

      Payment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: payments,
      page,
      limit,
      totalCount,
      hasMore: skip + payments.length < totalCount,
      totals: {
        totalAmount: totals[0]?.totalAmount ?? 0,
        count: totals[0]?.count ?? 0,
      },
    });
  } catch (error) {
    console.error("Get payments error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch payments" },
      { status: 500 },
    );
  }
}
