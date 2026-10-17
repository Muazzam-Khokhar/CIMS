import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vehicle from "@/models/Vehicle";
import Sale from "@/models/Sale";
import Payment from "@/models/Payment";
import VehicleExpense from "@/models/VehicleExpense";
import Loan from "@/models/Loan";
import FinanceTransaction from "@/models/FinanceTransaction";
import { SIGNED_AMOUNT, netPaidBySale } from "@/lib/paymentTotals";
import { computeMoneyOverview } from "@/controllers/moneyController";

const DAY = 86_400_000;

export async function getDashboard() {
  try {
    await connectDB();

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();

    const monthStart = new Date(Date.UTC(y, m, 1));
    const chartStart = new Date(Date.UTC(y, m - 5, 1));

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 5 + i, 1));
      return {
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      };
    });

    const [
      available,
      soldSoFar,
      sales,
      netPaid,
      monthPayments,
      paymentsByMonth,
      recentPayments,
      money,
    ] = await Promise.all([
      Vehicle.find({ status: "AVAILABLE" })
        .select("name model purchasePrice purchaseDate createdAt")
        .lean(),

      Vehicle.countDocuments({ status: "SOLD" }),

      Sale.find({ status: { $ne: "RETURNED" } })
        .select("vehicleId salePrice saleDate")
        .populate("vehicleId", "name model")
        .sort({ saleDate: -1, createdAt: -1 })
        .lean(),

      netPaidBySale(),

      Payment.aggregate([
        { $match: { paymentDate: { $gte: monthStart } } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),

      Payment.aggregate([
        { $match: { paymentDate: { $gte: chartStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } },
            total: { $sum: SIGNED_AMOUNT },
          },
        },
      ]),

      Payment.find()
        .select("saleId amount type paymentDate")
        .populate({
          path: "saleId",
          select: "vehicleId",
          populate: { path: "vehicleId", select: "name model" },
        })
        .sort({ paymentDate: -1, createdAt: -1 })
        .limit(6)
        .lean(),

      computeMoneyOverview().catch(() => null),
    ]);

    /* ------------------------------ stock ------------------------------ */
    const stockIds = available.map((v: any) => v._id);

    const stockExpenseRows = stockIds.length
      ? await VehicleExpense.aggregate([
          { $match: { vehicleId: { $in: stockIds } } },
          { $group: { _id: "$vehicleId", total: { $sum: "$amount" } } },
        ])
      : [];

    const expenseByVehicle = new Map(
      stockExpenseRows.map((r: any) => [String(r._id), Number(r.total)]),
    );

    const stockItems = available.map((v: any) => {
      const cost =
        Number(v.purchasePrice || 0) + (expenseByVehicle.get(String(v._id)) || 0);
      const since = new Date(v.purchaseDate || v.createdAt).getTime();
      return {
        _id: String(v._id),
        name: `${v.name} ${v.model || ""}`.trim(),
        days: Math.max(0, Math.floor((now.getTime() - since) / DAY)),
        cost,
      };
    });

    const stockCost = stockItems.reduce((s, v) => s + v.cost, 0);
    const oldest = [...stockItems].sort((a, b) => b.days - a.days).slice(0, 5);

    /* ----------------------------- customers ----------------------------- */
    let outstanding = 0;
    const owed: {
      saleId: string;
      name: string;
      price: number;
      remaining: number;
      days: number;
      saleDate: Date;
    }[] = [];

    for (const sale of sales as any[]) {
      const paid = netPaid.get(String(sale._id)) || 0;
      const remaining = Math.max(Number(sale.salePrice) - paid, 0);
      if (remaining <= 0.005) continue;

      outstanding += remaining;
      owed.push({
        saleId: String(sale._id),
        name: `${sale.vehicleId?.name || "Vehicle"} ${sale.vehicleId?.model || ""}`.trim(),
        price: Number(sale.salePrice),
        remaining,
        days: Math.max(0, Math.floor((now.getTime() - new Date(sale.saleDate).getTime()) / DAY)),
        saleDate: sale.saleDate,
      });
    }

    const owedList = owed
      .sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime())
      .slice(0, 5)
      .map(({ saleDate, ...rest }) => rest);

    /* ------------------------------- month ------------------------------- */
    const soldThisMonth = (sales as any[]).filter(
      (s) => new Date(s.saleDate) >= monthStart,
    );

    let received = 0;
    let refunded = 0;
    for (const row of monthPayments) {
      if (row._id === "REFUND") refunded += row.total;
      else received += row.total;
    }

    /* ------------------------------- chart ------------------------------- */
    const salesByMonth = new Map<string, number>();
    for (const s of sales as any[]) {
      const key = new Date(s.saleDate).toISOString().slice(0, 7);
      salesByMonth.set(key, (salesByMonth.get(key) || 0) + Number(s.salePrice));
    }

    const paidMonth = new Map(paymentsByMonth.map((r: any) => [r._id, r.total as number]));

    const chart = months.map(({ key, label }) => ({
      label,
      sales: salesByMonth.get(key) || 0,
      received: paidMonth.get(key) || 0,
    }));

    /* ----------------------------- loans due ----------------------------- */
    const dueLoans = await Loan.find({
      status: "ACTIVE",
      dueDate: { $ne: null, $lte: new Date(now.getTime() + 14 * DAY) },
    })
      .select("direction counterpartyName principalAmount dueDate")
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();

    const repaidRows = dueLoans.length
      ? await FinanceTransaction.aggregate([
          {
            $match: {
              status: "VALID",
              type: { $in: ["LOAN_PRINCIPAL_REPAYMENT", "PARTNER_ADVANCE_REPAID"] },
              loanId: { $in: dueLoans.map((l: any) => l._id) },
            },
          },
          { $group: { _id: "$loanId", total: { $sum: "$amount" } } },
        ])
      : [];

    const repaid = new Map(repaidRows.map((r: any) => [String(r._id), Number(r.total)]));

    const loansDue = (dueLoans as any[])
      .map((l) => ({
        _id: String(l._id),
        direction: l.direction,
        name: l.counterpartyName,
        outstanding: Math.max(Number(l.principalAmount) - (repaid.get(String(l._id)) || 0), 0),
        dueDate: l.dueDate,
        overdue: new Date(l.dueDate) < now,
      }))
      .filter((l) => l.outstanding > 0.005)
      .slice(0, 5);

    /* ----------------------------- activity ----------------------------- */
    type Item = {
      id: string;
      kind: "sale" | "payment" | "refund" | "return";
      title: string;
      amount: number;
      date: Date;
    };

    const nameOf = (v: any) => `${v?.name || "Vehicle"} ${v?.model || ""}`.trim();

    const activity: Item[] = [
      ...(sales as any[]).slice(0, 6).map((s) => ({
        id: `s-${s._id}`,
        kind: "sale" as const,
        title: nameOf(s.vehicleId),
        amount: Number(s.salePrice),
        date: s.saleDate,
      }))
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    return NextResponse.json({
      success: true,
      data: {
        stock: { count: available.length, cost: stockCost, soldSoFar, oldest },
        month: {
          label: now.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }),
          soldCount: soldThisMonth.length,
          soldValue: soldThisMonth.reduce((s, x: any) => s + Number(x.salePrice), 0),
          received: received - refunded,
          refunded,
        },
        outstanding,
        owedList,
        chart,
        loansDue,
        activity,
        money: money
          ? {
              cash: money.cashEstimate,
              youOwe: money.youOwe,
              partnersOwe: money.partnersOweLoans + money.stillWithPartners,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get dashboard error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load dashboard" },
      { status: 500 },
    );
  }
}