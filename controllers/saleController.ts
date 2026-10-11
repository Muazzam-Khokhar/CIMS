import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vehicle from "@/models/Vehicle";
import Sale from "@/models/Sale";
import Payment from "@/models/Payment";
import mongoose from "mongoose";
import { createAuditLog } from "@/lib/audit";
import { getPaginationParams } from "@/lib/pagination";

type AuditActor = {
  userId: string;
  name: string;
  role: "OWNER" | "MANAGER" | "STAFF";
};
export async function createSale(data: {
  vehicleId: string;
  saleType: "CUSTOMER" | "AUCTION";
  salePrice: number;
  saleDate: string;
  status:String;

  initialPayment?: {
    amount: number;
    paymentDate: string;
    paymentMethod:
      | "CASH"
      | "BANK"
      | "ONLINE"
      | "OTHER";
    notes?: string;
  }},actor:AuditActor
) {
  await connectDB();
  const session = await mongoose.startSession();

  try {
    if (!mongoose.isValidObjectId(data.vehicleId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid vehicle ID",
        },
        { status: 400 },
      );
    }

    if (
      !["CUSTOMER", "AUCTION"].includes(
        data.saleType,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sale type",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(data.salePrice) ||
      data.salePrice <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Sale price must be greater than 0",
        },
        { status: 400 },
      );
    }

    const saleDate = new Date(data.saleDate);

    if (Number.isNaN(saleDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sale date",
        },
        { status: 400 },
      );
    }

    let createdSale: any = null;
    let createdPayment: any = null;

    await session.withTransaction(async () => {
      const vehicle = await Vehicle.findById(
        data.vehicleId,
      ).session(session);

      if (!vehicle) {
        throw new Error("Vehicle not found");
      }

      if (vehicle.status !== "AVAILABLE") {
        throw new Error(
          "Only available vehicles can be sold",
        );
      }

      const existingSale = await Sale.findOne({ vehicleId: data.vehicleId, status: "ACTIVE" })
                            .session(session);

      if (existingSale) {
        throw new Error(
          "This vehicle already has a sale record",
        );
      }

      if (data.initialPayment) {
        const {
          amount,
          paymentDate,
          paymentMethod,
        } = data.initialPayment;

        const parsedPaymentDate = new Date(
          paymentDate,
        );

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          throw new Error(
            "Payment amount must be greater than 0",
          );
        }

        if (amount > data.salePrice) {
          throw new Error(
            "Payment cannot exceed sale price",
          );
        }

        if (
          Number.isNaN(
            parsedPaymentDate.getTime(),
          )
        ) {
          throw new Error(
            "Invalid payment date",
          );
        }

        if (
          ![
            "CASH",
            "BANK",
            "ONLINE",
            "OTHER",
          ].includes(paymentMethod)
        ) {
          throw new Error(
            "Invalid payment method",
          );
        }
      }

      const [sale] = await Sale.create(
        [
          {
            vehicleId: data.vehicleId,
            saleType: data.saleType,
            salePrice: data.salePrice,
            saleDate,
          },
        ],
        { session },
      );

      createdSale = sale;

      vehicle.status = "SOLD";

      await vehicle.save({ session });
      await createAuditLog({
        actor,
        action: "SELL",
        entity: "SALE",
        entityId: sale._id.toString(),
        description: `Vehicle sold for Rs. ${data.salePrice}`,
        after: {
          vehicleId: data.vehicleId,
          saleType: data.saleType,
          salePrice: data.salePrice,
          saleDate: data.saleDate,
          initialPayment: data.initialPayment
            ? {
                amount: data.initialPayment.amount,
                paymentDate: data.initialPayment.paymentDate,
                paymentMethod:
                  data.initialPayment.paymentMethod,
              }
            : null,
        },
        session,
      });
      

      if (data.initialPayment) {
        const [payment] = await Payment.create(
          [
            {
              saleId: sale._id,
              amount: data.initialPayment.amount,
              paymentDate: new Date(
                data.initialPayment.paymentDate,
              ),
              paymentMethod:
                data.initialPayment.paymentMethod,
              notes:
                data.initialPayment.notes
                  ?.trim() || undefined,
            },
          ],
          { session },
        );

        createdPayment = payment;
        await createAuditLog({
          actor,
          action: "PAYMENT_CREATE",
          entity: "PAYMENT",
          entityId: payment._id.toString(),
          description: `Payment of Rs. ${data.initialPayment.amount} added`,
          after: {
            saleId: sale._id.toString(),
            amount: data.initialPayment.amount,
            paymentDate: data.initialPayment.paymentDate,
            paymentMethod:
              data.initialPayment.paymentMethod,
            notes:
              data.initialPayment.notes?.trim() || undefined,
          },
          session,
        });
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: createdPayment
          ? "Vehicle sold and payment saved successfully"
          : "Vehicle sold successfully",
        data: {
          sale: createdSale,
          payment: createdPayment,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Create sale transaction error:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This vehicle already has a sale record",
        },
        { status: 409 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create sale";

    const knownMessages = [
      "Vehicle not found",
      "Only available vehicles can be sold",
      "This vehicle already has a sale record",
      "Payment amount must be greater than 0",
      "Payment cannot exceed sale price",
      "Invalid payment date",
      "Invalid payment method",
      "Invalid vehicle ID",
      "Invalid sale type",
      "Sale price must be greater than 0",
      "Invalid sale date",
    ];

    if (knownMessages.includes(message)) {
      return NextResponse.json(
        {
          success: false,
          message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create sale",
      },
      { status: 500 },
    );
  } finally {
    await session.endSession();
  }
}
export async function getSales(searchParams: URLSearchParams) {
  try {
    await connectDB();

    const { page, limit, skip } = getPaginationParams(searchParams);
    const search = searchParams.get("search")?.trim() || "";
    const requestedType = searchParams.get("saleType") || "ALL";

    const filter: Record<string, unknown> = {};

    if (requestedType === "CUSTOMER" || requestedType === "AUCTION") {
      filter.saleType = requestedType;
    }
    const requestedStatus = searchParams.get("status") || "ACTIVE";
    if (requestedStatus === "RETURNED") filter.status = "RETURNED";
    else if (requestedStatus === "ACTIVE") filter.status = { $ne: "RETURNED" };

    // Search vehicle fields, then filter sales by matching vehicle IDs.
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const matchingVehicles = await Vehicle.find({
        $or: [
          { name: { $regex: escapedSearch, $options: "i" } },
          { model: { $regex: escapedSearch, $options: "i" } },
          { chassisNumber: { $regex: escapedSearch, $options: "i" } },
          { registrationNumber: { $regex: escapedSearch, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();

      filter.vehicleId = {
        $in: matchingVehicles.map((vehicle) => vehicle._id),
      };
    }

    const [sales, totalsResult, totalCount] = await Promise.all([
      Sale.find(filter)
        .populate({
          path: "vehicleId",
          select:
            "name model year color chassisNumber registrationNumber purchasePrice",
        })
        .sort({ saleDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      // Global totals for all sales matching the active filters,
      // not just the current page.
      Sale.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: Payment.collection.name,
            let: { saleId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$saleId", "$$saleId"] } } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
            as: "paymentSummary",
          },
        },
        {
          $addFields: {
            totalPaid: {
              $ifNull: [{ $arrayElemAt: ["$paymentSummary.total", 0] }, 0],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$salePrice" },
            totalPaid: { $sum: "$totalPaid" },
            totalRemaining: {
              $sum: {
                $max: [{ $subtract: ["$salePrice", "$totalPaid"] }, 0],
              },
            },
          },
        },
      ]),

      Sale.countDocuments(filter),
    ]);

    const saleIds = sales.map((sale) => sale._id);

    const paymentTotals = await Payment.aggregate([
      { $match: { saleId: { $in: saleIds } } },
      {
        $group: {
          _id: "$saleId",
          totalPaid: { $sum: "$amount" },
        },
      },
    ]);

    const paymentMap = new Map(
      paymentTotals.map((item) => [
        item._id.toString(),
        item.totalPaid,
      ]),
    );

    const data = sales.map((sale) => {
      const totalPaid = paymentMap.get(sale._id.toString()) || 0;
      const isReturned = sale.status === "RETURNED";
      const remaining = isReturned ? 0 : Math.max(sale.salePrice - totalPaid, 0);
      
      return {
        ...sale,
        totalPaid,
        remaining,
        paymentStatus: isReturned ? "RETURNED" : remaining === 0 ? "PAID" : "PARTIAL",
      };
    });

    const totals = totalsResult[0] || {
      totalSales: 0,
      totalPaid: 0,
      totalRemaining: 0,
    };

    return NextResponse.json({
      success: true,
      data,
      page,
      limit,
      totalCount,
      hasMore: skip + data.length < totalCount,
      totals: {
        totalSales: totals.totalSales,
        totalPaid: totals.totalPaid,
        totalRemaining: totals.totalRemaining,
      },
    });
  } catch (error) {
    console.error("Get sales error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch sales" },
      { status: 500 },
    );
  }
}
export async function returnSale(
  saleId: string,
  data: { returnDate: string; refundAmount: number; reason?: string },
  actor: AuditActor,
) {
  await connectDB();
  const session = await mongoose.startSession();

  try {
    if (!mongoose.isValidObjectId(saleId)) {
      return NextResponse.json({ success: false, message: "Invalid sale ID" }, { status: 400 });
    }

    const returnDate = new Date(data.returnDate);
    if (Number.isNaN(returnDate.getTime())) {
      return NextResponse.json({ success: false, message: "Invalid return date" }, { status: 400 });
    }

    if (!Number.isFinite(data.refundAmount) || data.refundAmount < 0) {
      return NextResponse.json({ success: false, message: "Invalid refund amount" }, { status: 400 });
    }

    await session.withTransaction(async () => {
      const sale = await Sale.findById(saleId).session(session);
      if (!sale) throw new Error("Sale not found");
      if (sale.status === "RETURNED") throw new Error("This sale is already returned");

      const paid = await Payment.aggregate([
        { $match: { saleId: sale._id } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).session(session);
      const totalPaid: number = paid[0]?.total ?? 0;

      if (data.refundAmount > totalPaid) throw new Error("Refund cannot exceed amount received");

      const vehicle = await Vehicle.findById(sale.vehicleId).session(session);
      if (!vehicle) throw new Error("Vehicle not found");

      sale.status = "RETURNED";
      sale.returnDate = returnDate;
      sale.refundAmount = data.refundAmount;
      sale.returnReason = data.reason?.trim() || undefined;
      await sale.save({ session });

      vehicle.status = "AVAILABLE";
      await vehicle.save({ session });

      await createAuditLog({
        actor,
        action: "RETURN",
        entity: "SALE",
        entityId: sale._id.toString(),
        description: `Sale returned, Rs. ${data.refundAmount} refunded of Rs. ${totalPaid} received`,
        after: {
          status: "RETURNED",
          refundAmount: data.refundAmount,
          returnDate: data.returnDate,
          reason: data.reason,
        },
        session,
      });
    });

    return NextResponse.json({ success: true, message: "Sale returned. Vehicle is available again." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known = [
      "Sale not found",
      "This sale is already returned",
      "Vehicle not found",
      "Refund cannot exceed amount received",
    ];

    if (known.includes(message)) {
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    console.error("Return sale error:", error);
    return NextResponse.json({ success: false, message: "Failed to return sale" }, { status: 500 });
  } finally {
    await session.endSession();
  }
}
