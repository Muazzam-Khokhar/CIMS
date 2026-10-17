import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Sale from "@/models/Sale";
import Payment from "@/models/Payment";
import Vehicle from "@/models/Vehicle";
import { createAuditLog } from "@/lib/audit";
import {
  isValidDate,
  isValidObjectId,
  isValidPositiveNumber,
} from "@/lib/validation";
import { getPaginationParams } from "@/lib/pagination";
import { SIGNED_AMOUNT, netPaidBySale, signed } from "@/lib/paymentTotals";

type AuditActor = {
  userId: string;
  name: string;
  role: "OWNER" | "MANAGER" | "STAFF";
};

type Method = "CASH" | "BANK" | "ONLINE" | "OTHER";
const METHODS = ["CASH", "BANK", "ONLINE", "OTHER"];
const TOLERANCE = 0.005;

class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function fail(error: unknown, fallback: string) {
  if (error instanceof PaymentError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status },
    );
  }
  console.error(fallback, error);
  return NextResponse.json(
    { success: false, message: fallback },
    { status: 500 },
  );
}

const money = (n: number) => `¥. ${Math.round(n).toLocaleString("en-JP")}`;

/* ------------------------------ CREATE ------------------------------ */

export async function createPayment(
  data: {
    saleId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: Method;
    type?: "RECEIVED" | "REFUND";
    notes?: string;
  },
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!isValidObjectId(data.saleId)) throw new PaymentError("Invalid sale ID");
    if (!isValidPositiveNumber(data.amount))
      throw new PaymentError("Amount must be greater than 0");
    if (!isValidDate(data.paymentDate))
      throw new PaymentError("A valid date is required");
    if (!METHODS.includes(data.paymentMethod))
      throw new PaymentError("Invalid payment method");

    const type = data.type === "REFUND" ? "REFUND" : "RECEIVED";
    let created: any;

    await session.withTransaction(async () => {
      const sale = await Sale.findById(data.saleId).session(session);

      if (!sale) throw new PaymentError("Sale not found", 404);
      if (sale.status === "RETURNED")
        throw new PaymentError(
          "This sale was returned. Payments can't be changed.",
        );

      const net =
        (await netPaidBySale([sale._id], session)).get(String(sale._id)) ?? 0;

      if (type === "RECEIVED" && data.amount > sale.salePrice - net + TOLERANCE) {
        throw new PaymentError(
          `Payment cannot be more than the remaining ${money(sale.salePrice - net)}`,
        );
      }

      if (type === "REFUND" && data.amount > net + TOLERANCE) {
        throw new PaymentError(
          `You can return at most ${money(net)}, the amount received so far`,
        );
      }

      const [payment] = await Payment.create(
        [
          {
            saleId: data.saleId,
            type,
            amount: data.amount,
            paymentDate: new Date(data.paymentDate),
            paymentMethod: data.paymentMethod,
            notes: data.notes?.trim() || undefined,
          },
        ],
        { session },
      );

      created = payment;
      if (type === "REFUND" && net - data.amount <= TOLERANCE) {
        const refunds = await Payment.aggregate([
          { $match: { saleId: sale._id, type: "REFUND" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]).session(session);
      
        const vehicle = await Vehicle.findById(sale.vehicleId).session(session);
        if (!vehicle) throw new PaymentError("Vehicle not found", 404);
      
        sale.status = "RETURNED";
        sale.returnDate = new Date(data.paymentDate);
        sale.refundAmount = refunds[0]?.total ?? data.amount;
        sale.returnReason = data.notes?.trim() || "All payments returned";
        await sale.save({ session });
      
        vehicle.status = "AVAILABLE";
        await vehicle.save({ session });
      
        await createAuditLog({
          actor,
          action: "RETURN",
          entity: "SALE",
          entityId: sale._id.toString(),
          description: `Sale auto-returned: all payments refunded`,
          after: { status: "RETURNED", refundAmount: sale.refundAmount },
          session,
        });
      }

      await createAuditLog({
        actor,
        action: "PAYMENT_CREATE",
        entity: "PAYMENT",
        entityId: payment._id.toString(),
        description:
          type === "REFUND"
            ? `${money(data.amount)} returned to customer on sale ${data.saleId}`
            : `Payment of ${money(data.amount)} added to sale ${data.saleId}`,
        after: {
          saleId: data.saleId,
          type,
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
        message: type === "REFUND" ? "Payment returned" : "Payment added successfully",
        data: created,
      },
      { status: 201 },
    );
  } catch (error) {
    return fail(error, "Failed to save payment");
  } finally {
    await session.endSession();
  }
}

/* ------------------------------- LIST ------------------------------- */

export async function getPayments(searchParams: URLSearchParams) {
  try {
    await connectDB();

    const { page, limit, skip } = getPaginationParams(searchParams);
    const method = searchParams.get("paymentMethod") || "ALL";
    const type = searchParams.get("type") || "ALL";
    const search = searchParams.get("search")?.trim() || "";

    if (method !== "ALL" && !METHODS.includes(method)) {
      throw new PaymentError("Invalid payment method");
    }

    const filter: Record<string, unknown> = {};

    const saleIdParam = searchParams.get("saleId");
    if (saleIdParam && mongoose.isValidObjectId(saleIdParam)) {
      filter.saleId = new mongoose.Types.ObjectId(saleIdParam);
    }

    if (method !== "ALL") filter.paymentMethod = method;

    // Old payments have no type, so "received" means "not a refund"
    if (type === "REFUND") filter.type = "REFUND";
    else if (type === "RECEIVED") filter.type = { $ne: "REFUND" };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const matchingVehicles = await Vehicle.find({
        $or: [
          { name: { $regex: escaped, $options: "i" } },
          { model: { $regex: escaped, $options: "i" } },
          { chassisNumber: { $regex: escaped, $options: "i" } },
        ],
      }).distinct("_id");

      const matchingSales = await Sale.find({
        $or: [
          { vehicleId: { $in: matchingVehicles } },
          ...(mongoose.isValidObjectId(search) ? [{ _id: search }] : []),
        ],
      }).distinct("_id");

      filter.saleId = { $in: matchingSales };
    }

    const [payments, totalCount, totalRows] = await Promise.all([
      Payment.find(filter)
        .populate({
          path: "saleId",
          select: "vehicleId saleType salePrice saleDate status",
          populate: { path: "vehicleId", select: "name model chassisNumber" },
        })
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Payment.countDocuments(filter),

      Payment.aggregate([
        { $match: filter },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),
    ]);

    let received = 0;
    let returned = 0;

    for (const row of totalRows) {
      if (row._id === "REFUND") returned += row.total;
      else received += row.total;
    }
    const saleIds = [
      ...new Set(
        payments
          .map((p: any) => p.saleId?._id)
          .filter(Boolean)
          .map(String),
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));
    
    const nets = await Payment.aggregate([
      { $match: { saleId: { $in: saleIds } } },
      { $group: { _id: "$saleId", net: { $sum: SIGNED_AMOUNT } } },
    ]);
    const netMap = new Map(nets.map((n) => [String(n._id), n.net]));
    
    const data = payments.map((p: any) => ({
      ...p,
      saleNet: p.saleId ? netMap.get(String(p.saleId._id)) ?? 0 : 0,
    }));
    return NextResponse.json({
      success: true,
      data: data,
      page,
      limit,
      totalCount,
      hasMore: skip + data.length < totalCount,
      totals: {
        received,
        returned,
        net: received - returned,
      },
    });
  } catch (error) {
    return fail(error, "Failed to fetch payments");
  }
}

/* ------------------------------ UPDATE ------------------------------ */

async function netExcluding(
  saleId: mongoose.Types.ObjectId,
  paymentId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession,
) {
  const rows = await Payment.aggregate([
    { $match: { saleId, _id: { $ne: paymentId } } },
    { $group: { _id: null, total: { $sum: SIGNED_AMOUNT } } },
  ]).session(session);

  return Number(rows[0]?.total ?? 0);
}

export async function updatePayment(
  id: string,
  data: {
    amount?: number;
    paymentDate?: string;
    paymentMethod?: Method;
    notes?: string;
  },
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!isValidObjectId(id)) throw new PaymentError("Invalid ID");

    let updated: any;

    await session.withTransaction(async () => {
      const payment = await Payment.findById(id).session(session);
      if (!payment) throw new PaymentError("Payment not found", 404);

      const sale = await Sale.findById(payment.saleId).session(session);
      if (!sale) throw new PaymentError("Sale not found", 404);
      if (sale.status === "RETURNED")
        throw new PaymentError(
          "This sale was returned. Payments can't be changed.",
        );

      const before = {
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        notes: payment.notes,
      };

      if (data.amount !== undefined) {
        if (!isValidPositiveNumber(data.amount))
          throw new PaymentError("Invalid payment amount");
        payment.amount = data.amount;
      }

      if (data.paymentDate !== undefined) {
        if (!isValidDate(data.paymentDate))
          throw new PaymentError("Invalid payment date");
        payment.paymentDate = new Date(data.paymentDate);
      }

      if (data.paymentMethod !== undefined) {
        if (!METHODS.includes(data.paymentMethod))
          throw new PaymentError("Invalid payment method");
        payment.paymentMethod = data.paymentMethod;
      }

      if (data.notes !== undefined) {
        payment.notes = data.notes.trim() || undefined;
      }

      const net =
        (await netExcluding(payment.saleId, payment._id, session)) +
        signed(payment);

      if (net > sale.salePrice + TOLERANCE)
        throw new PaymentError("Payment cannot be more than the sale price");
      if (net < -TOLERANCE)
        throw new PaymentError(
          "More money would be returned than was received",
        );

      await payment.save({ session });
      updated = payment;

      await createAuditLog({
        actor,
        action: "PAYMENT_UPDATE",
        entity: "PAYMENT",
        entityId: payment._id.toString(),
        description: `Payment updated on sale ${sale._id.toString()}`,
        before,
        after: {
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          notes: payment.notes,
        },
        session,
      });
    });

    return NextResponse.json({
      success: true,
      message: "Payment updated successfully",
      data: updated,
    });
  } catch (error) {
    return fail(error, "Failed to update payment");
  } finally {
    await session.endSession();
  }
}

/* ------------------------------ DELETE ------------------------------ */

export async function deletePayment(id: string, actor: AuditActor) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!isValidObjectId(id)) throw new PaymentError("Invalid ID");

    await session.withTransaction(async () => {
      const payment = await Payment.findById(id).session(session);
      if (!payment) throw new PaymentError("Payment not found", 404);

      const sale = await Sale.findById(payment.saleId).session(session);
      if (!sale) throw new PaymentError("Sale not found", 404);
      if (sale.status === "RETURNED")
        throw new PaymentError(
          "This sale was returned. Payments can't be changed.",
        );

      const others = await netExcluding(payment.saleId, payment._id, session);

      if (others < -TOLERANCE)
        throw new PaymentError(
          "Money was returned against this payment. Delete the returned entry first.",
        );
      if (others > sale.salePrice + TOLERANCE)
        throw new PaymentError(
          "Deleting this returned entry would make the customer's payments more than the sale price.",
        );

      const before = {
        saleId: payment.saleId.toString(),
        type: payment.type,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        notes: payment.notes,
      };

      await Payment.deleteOne({ _id: payment._id }).session(session);

      await createAuditLog({
        actor,
        action: "PAYMENT_DELETE",
        entity: "PAYMENT",
        entityId: payment._id.toString(),
        description: `${payment.type === "REFUND" ? "Returned entry" : "Payment"} of ${money(
          before.amount,
        )} deleted from sale ${sale._id.toString()}`,
        before,
        session,
      });
    });

    return NextResponse.json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error) {
    return fail(error, "Failed to delete payment");
  } finally {
    await session.endSession();
  }
}