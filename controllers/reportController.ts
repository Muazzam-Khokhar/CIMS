import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Sale from "@/models/Sale";
import Payment from "@/models/Payment";
import VehicleExpense from "@/models/VehicleExpense";
import GeneralExpense from "@/models/GeneralExpense";
import Vehicle from "@/models/Vehicle";
import { netPaidBySale } from "@/lib/paymentTotals";

type ReportQuery = { from?: string; to?: string };

function getDateRange(from?: string, to?: string) {
  const startDate = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
  const endDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined;

  if (
    (startDate && Number.isNaN(startDate.getTime())) ||
    (endDate && Number.isNaN(endDate.getTime())) ||
    (startDate && endDate && startDate > endDate)
  ) {
    return null;
  }

  return { startDate, endDate };
}

function between(field: string, start?: Date, end?: Date) {
  if (!start && !end) return {};
  const range: Record<string, Date> = {};
  if (start) range.$gte = start;
  if (end) range.$lte = end;
  return { [field]: range };
}

const sum = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

export async function getReports(query: ReportQuery) {
  try {
    await connectDB();

    const range = getDateRange(query.from, query.to);

    if (!range) {
      return NextResponse.json(
        { success: false, message: "Invalid report date range" },
        { status: 400 },
      );
    }

    const { startDate, endDate } = range;

    const [sales, generalExpenses, paymentRows, returned] = await Promise.all([
      Sale.find({
        status: { $ne: "RETURNED" },
        ...between("saleDate", startDate, endDate),
      })
        .populate({
          path: "vehicleId",
          model: Vehicle,
          select: "name model chassisNumber purchasePrice",
        })
        .sort({ saleDate: -1 })
        .lean(),

      GeneralExpense.find(between("expenseDate", startDate, endDate))
        .select("title amount")
        .lean(),

      Payment.aggregate([
        { $match: between("paymentDate", startDate, endDate) },
        {
          $group: {
            _id: { method: "$paymentMethod", type: "$type" },
            total: { $sum: "$amount" },
          },
        },
      ]),

      Sale.aggregate([
        {
          $match: {
            status: "RETURNED",
            ...between("returnDate", startDate, endDate),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$refundAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    /* ------------------------ cars sold in the period ------------------------ */
    const soldVehicleIds = (sales as any[])
      .map((s) => s.vehicleId?._id)
      .filter(Boolean);

    const carExpenseRows = soldVehicleIds.length
      ? await VehicleExpense.find({ vehicleId: { $in: soldVehicleIds } })
          .select("vehicleId amount expenseDate")
          .lean()
      : [];

    const netPaid = sales.length
      ? await netPaidBySale((sales as any[]).map((s) => s._id))
      : new Map<string, number>();

    const sold = (sales as any[]).map((sale) => {
      const v = sale.vehicleId;
      const saleDate = new Date(sale.saleDate);
      const purchasePrice = Number(v?.purchasePrice || 0);

      // Repairs on this car up to the day it was sold
      const carExpenses = sum(
        (carExpenseRows as any[]).filter(
          (e) =>
            String(e.vehicleId) === String(v?._id) &&
            new Date(e.expenseDate) <= saleDate,
        ),
        (e) => Number(e.amount || 0),
      );

      const salePrice = Number(sale.salePrice || 0);
      const paid = netPaid.get(String(sale._id)) ?? 0;

      return {
        saleId: sale._id,
        vehicle: {
          name: v?.name,
          model: v?.model,
          chassisNumber: v?.chassisNumber,
        },
        saleType: sale.saleType,
        saleDate: sale.saleDate,
        purchasePrice,
        carExpenses,
        cost: purchasePrice + carExpenses,
        salePrice,
        profit: salePrice - purchasePrice - carExpenses,
        paid,
        remaining: Math.max(salePrice - paid, 0),
      };
    });

    /* ---------------------------- money from customers ---------------------------- */
    let received = 0;
    let refundedPayments = 0;
    const methodNet = new Map<string, number>();

    for (const row of paymentRows) {
      const isRefund = row._id.type === "REFUND";
      const amount = Number(row.total || 0);

      if (isRefund) refundedPayments += amount;
      else received += amount;

      methodNet.set(
        row._id.method,
        (methodNet.get(row._id.method) || 0) + (isRefund ? -amount : amount),
      );
    }

    const returnsRefunded = Number(returned[0]?.total || 0);
    const refunded = refundedPayments + returnsRefunded;

    /* ------------------------------- shop expenses ------------------------------- */
    const groups = new Map<string, { title: string; total: number; count: number }>();

    for (const e of generalExpenses as any[]) {
      const title = String(e.title).trim();
      const key = title.toLowerCase();
      const g = groups.get(key) ?? { title, total: 0, count: 0 };
      g.total += Number(e.amount || 0);
      g.count += 1;
      groups.set(key, g);
    }

    const ordered = [...groups.values()].sort((a, b) => b.total - a.total);
    const shopExpenses = ordered.slice(0, 6);
    const rest = ordered.slice(6);

    if (rest.length) {
      shopExpenses.push({
        title: "Other",
        total: sum(rest, (g) => g.total),
        count: sum(rest, (g) => g.count),
      });
    }

    /* --------------------------------- summary --------------------------------- */
    const salesTotal = sum(sold, (s) => s.salePrice);
    const carsCost = sum(sold, (s) => s.purchasePrice);
    const carExpensesOnSold = sum(sold, (s) => s.carExpenses);
    const grossProfit = salesTotal - carsCost - carExpensesOnSold;
    const shopTotal = sum(generalExpenses as any[], (e) => Number(e.amount || 0));

    return NextResponse.json({
      success: true,
      data: {
        period: { from: query.from || null, to: query.to || null },
        summary: {
          salesCount: sold.length,
          salesTotal,
          carsCost,
          carExpensesOnSold,
          grossProfit,
          shopExpenses: shopTotal,
          netProfit: grossProfit - shopTotal,
          received,
          refunded,
          netReceived: received - refunded,
          outstanding: sum(sold, (s) => s.remaining),
          returnsCount: Number(returned[0]?.count || 0),
          returnsRefunded,
        },
        byMethod: [...methodNet.entries()]
          .map(([method, total]) => ({ method, total }))
          .filter((m) => Math.abs(m.total) > 0.005)
          .sort((a, b) => b.total - a.total),
        shopExpenses,
        sold,
      },
    });
  } catch (error) {
    console.error("Get reports error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate reports" },
      { status: 500 },
    );
  }
}