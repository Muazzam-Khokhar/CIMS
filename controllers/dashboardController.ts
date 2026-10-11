import { NextResponse } from "next/server";
import {connectDB} from "@/lib/mongodb";

import Vehicle from "@/models/Vehicle";
import Sale from "@/models/Sale";
import Payment from "@/models/Payment";
import VehicleExpense from "@/models/VehicleExpense";
import GeneralExpense from "@/models/GeneralExpense";
import { Types } from "mongoose";

type PopulatedVehicle = {
  _id: Types.ObjectId;
  name: string;
  model: string;
  year: number;
  chassisNumber: string;
  registrationNumber?: string;
  purchasePrice?: number;
};

export async function getDashboard() {
  try {
    await connectDB();

    /*
     * ---------------------------------------------------------
     * INVENTORY COUNTS
     * ---------------------------------------------------------
     */
    const [
      totalVehicles,
      availableVehicles,
      soldVehicles,
      discardedVehicles,
    ] = await Promise.all([
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ status: "AVAILABLE" }),
      Vehicle.countDocuments({ status: "SOLD" }),
      Vehicle.countDocuments({ status: "DISCARDED" }),
    ]);

    /*
     * ---------------------------------------------------------
     * SALES
     * ---------------------------------------------------------
     */
    const sales = await Sale.find({ status: { $ne: "RETURNED" }})
      .select(
        "vehicleId saleType salePrice saleDate",
      )
      .populate<{ vehicleId: PopulatedVehicle | null }>({
        path: "vehicleId",
        select: "name model year chassisNumber registrationNumber purchasePrice",
      })
      .sort({ saleDate: -1, createdAt: -1 })
      .lean();
    const refundAgg = await Sale.aggregate([
        { $match: { status: "RETURNED" } },
        { $group: { _id: null, total: { $sum: "$refundAmount" } } },
      ]);
    const totalRefunds: number = refundAgg[0]?.total ?? 0;
    /*
     * ---------------------------------------------------------
     * PAYMENTS
     * ---------------------------------------------------------
     */
    const paymentTotals = await Payment.aggregate([
      {
        $group: {
          _id: "$saleId",
          totalPaid: { $sum: "$amount" },
        },
      },
    ]);

    const paymentMap = new Map<string, number>();

    for (const item of paymentTotals) {
      paymentMap.set(
        String(item._id),
        Number(item.totalPaid || 0),
      );
    }

    const allPaymentsTotal = paymentTotals.reduce(
      (sum, item) =>
        sum + Number(item.totalPaid || 0),
      0,
    );

    /*
     * ---------------------------------------------------------
     * VEHICLE EXPENSES
     * ---------------------------------------------------------
     */
    const vehicleExpenses = await VehicleExpense.find()
      .select(
        "vehicleId title amount expenseDate",
      )
      .sort({
        expenseDate: -1,
        createdAt: -1,
      })
      .lean();

    const totalVehicleExpenses =
      vehicleExpenses.reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0,
      );

    /*
     * ---------------------------------------------------------
     * GENERAL EXPENSES
     * ---------------------------------------------------------
     */
    const generalExpenses = await GeneralExpense.find()
      .select("title amount expenseDate")
      .sort({
        expenseDate: -1,
        createdAt: -1,
      })
      .lean();

    const totalGeneralExpenses =
      generalExpenses.reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0,
      );

    /*
     * ---------------------------------------------------------
     * SALES TOTAL + OUTSTANDING
     * ---------------------------------------------------------
     */
    const totalSales = sales.reduce(
      (sum, sale) =>
        sum + Number(sale.salePrice || 0),
      0,
    );

    let totalOutstanding = 0;

    for (const sale of sales) {
      const paid =
        paymentMap.get(String(sale._id)) || 0;

      totalOutstanding += Math.max(
        Number(sale.salePrice || 0) - paid,
        0,
      );
    }

    /*
     * ---------------------------------------------------------
     * VEHICLE PROFITABILITY
     *
     * Investment:
     * purchase price + vehicle expenses up to sale date
     * ---------------------------------------------------------
     */
    const soldSales = sales.filter(
      (sale) => sale.vehicleId,
    );

    let grossVehicleProfit = 0;

    const profitability = soldSales.map((sale) => {
      const vehicle = sale.vehicleId;

      const purchasePrice = Number(
        vehicle?.purchasePrice || 0,
      );

      const saleDate = new Date(sale.saleDate);

      const vehicleExpenseTotal =
        vehicleExpenses
          .filter(
            (expense) =>
              String(expense.vehicleId) ===
                String(vehicle?._id) &&
              new Date(expense.expenseDate) <=
                saleDate,
          )
          .reduce(
            (sum, expense) =>
              sum + Number(expense.amount || 0),
            0,
          );

      const investment =
        purchasePrice + vehicleExpenseTotal;

      const profit =
        Number(sale.salePrice || 0) - investment;

      grossVehicleProfit += profit;

      return {
        saleId: sale._id,
        vehicle: {
          _id: vehicle?._id,
          name: vehicle?.name,
          model: vehicle?.model,
          year: vehicle?.year,
          chassisNumber: vehicle?.chassisNumber,
        },
        purchasePrice,
        vehicleExpenses: vehicleExpenseTotal,
        investment,
        salePrice: Number(sale.salePrice || 0),
        profit,
        saleDate: sale.saleDate,
      };
    });

    const businessNetProfit =
      grossVehicleProfit - totalGeneralExpenses;

    /*
     * ---------------------------------------------------------
     * RECENT PAYMENTS
     * ---------------------------------------------------------
     */
    const recentPayments = await Payment.find()
      .select(
        "saleId amount paymentDate paymentMethod notes",
      )
      .populate({
        path: "saleId",
        select: "saleType salePrice vehicleId",
        populate: {
          path: "vehicleId",
          select: "name model year chassisNumber",
        },
      })
      .sort({
        paymentDate: -1,
        createdAt: -1,
      })
      .limit(5)
      .lean();

    /*
     * ---------------------------------------------------------
     * RECENT SALES
     * ---------------------------------------------------------
     */
    const recentSales = sales
      .slice(0, 5)
      .map((sale) => {
        const totalPaid =
          paymentMap.get(String(sale._id)) || 0;

        return {
          _id: sale._id,
          saleType: sale.saleType,
          salePrice: Number(sale.salePrice || 0),
          saleDate: sale.saleDate,
          totalPaid,
          remaining: Math.max(
            Number(sale.salePrice || 0) -
              totalPaid,
            0,
          ),
          paymentStatus:
            Number(sale.salePrice || 0) -
              totalPaid <=
            0
              ? "PAID"
              : "PARTIAL",
          vehicle: sale.vehicleId
            ? {
                _id: sale.vehicleId._id,
                name: sale.vehicleId.name,
                model: sale.vehicleId.model,
                year: sale.vehicleId.year,
                chassisNumber:
                  sale.vehicleId.chassisNumber,
              }
            : null,
        };
      });

    /*
     * ---------------------------------------------------------
     * RESPONSE
     * ---------------------------------------------------------
     */
    return NextResponse.json({
      success: true,

      data: {
        summary: {
          totalVehicles,
          availableVehicles,
          soldVehicles,
          discardedVehicles,

          totalSales,
          totalReceived: allPaymentsTotal - totalRefunds,
          totalOutstanding,

          totalVehicleExpenses,
          totalGeneralExpenses,

          grossVehicleProfit,
          businessNetProfit,

          salesCount: sales.length,
          paymentCount: await Payment.countDocuments(),
          vehicleExpenseCount:
            vehicleExpenses.length,
          generalExpenseCount:
            generalExpenses.length,
        },

        recentSales,

        recentPayments,

        recentVehicleExpenses:
          vehicleExpenses.slice(0, 5),

        recentGeneralExpenses:
          generalExpenses.slice(0, 5),

        profitability,
      },
    });
  } catch (error) {
    console.error("Get dashboard error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load dashboard",
      },
      { status: 500 },
    );
  }
}