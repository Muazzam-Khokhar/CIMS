import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

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

type ReportQuery = {
  from?: string;
  to?: string;
};

function getDateRange(from?: string, to?: string) {
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (from) {
    startDate = new Date(`${from}T00:00:00.000Z`);
  }

  if (to) {
    endDate = new Date(`${to}T23:59:59.999Z`);
  }

  if (
    (startDate && Number.isNaN(startDate.getTime())) ||
    (endDate && Number.isNaN(endDate.getTime()))
  ) {
    return null;
  }

  if (startDate && endDate && startDate > endDate) {
    return null;
  }

  return {
    startDate,
    endDate,
  };
}

function buildDateFilter(
  field: string,
  startDate?: Date,
  endDate?: Date,
) {
  const filter: Record<string, unknown> = {};

  if (startDate || endDate) {
    filter[field] = {};

    if (startDate) {
      (filter[field] as Record<string, unknown>).$gte = startDate;
    }

    if (endDate) {
      (filter[field] as Record<string, unknown>).$lte = endDate;
    }
  }

  return filter;
}

export async function getReports(query: ReportQuery) {
  try {
    await connectDB();

    const range = getDateRange(query.from, query.to);

    if (!range) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid report date range",
        },
        { status: 400 },
      );
    }

    const { startDate, endDate } = range;

    /*
     * ---------------------------------------------------------
     * SALES
     * ---------------------------------------------------------
     */
    const sales = await Sale.find(
      buildDateFilter("saleDate", startDate, endDate),
    )
      .populate<{ vehicleId: PopulatedVehicle | null }>({
        path: "vehicleId",
        select: "name model year color chassisNumber registrationNumber purchasePrice purchaseDate",
      })
      .sort({ saleDate: -1 })
      .lean();

    const saleIds = sales.map((sale) => sale._id);

    /*
     * ---------------------------------------------------------
     * PAYMENTS
     *
     * Payments are filtered by PAYMENT DATE, not sale date.
     * ---------------------------------------------------------
     */
    const paymentFilter =
      buildDateFilter("paymentDate", startDate, endDate);

    const payments = await Payment.find(paymentFilter)
      .select("saleId amount paymentDate paymentMethod")
      .lean();

    /*
     * ---------------------------------------------------------
     * VEHICLE EXPENSES
     *
     * These are period expenses for reporting purposes.
     * ---------------------------------------------------------
     */
    const vehicleExpenses = await VehicleExpense.find(
      buildDateFilter("expenseDate", startDate, endDate),
    )
      .select("vehicleId title amount expenseDate")
      .lean();

    /*
     * ---------------------------------------------------------
     * GENERAL EXPENSES
     * ---------------------------------------------------------
     */
    const generalExpenses = await GeneralExpense.find(
      buildDateFilter("expenseDate", startDate, endDate),
    )
      .select("title amount expenseDate")
      .lean();

    /*
     * ---------------------------------------------------------
     * SUMMARY TOTALS
     * ---------------------------------------------------------
     */

    const totalSales = sales.reduce(
      (sum, sale) => sum + Number(sale.salePrice || 0),
      0,
    );

    const totalPayments = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );

    const totalVehicleExpenses = vehicleExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0,
    );

    const totalGeneralExpenses = generalExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0,
    );

    /*
     * Outstanding is based on the SALES in the selected period,
     * but uses all payments made against those sales.
     *
     * This gives the current receivable for sales in the report.
     */
    let totalReceivedForSelectedSales = 0;

    if (saleIds.length > 0) {
      const selectedSalePayments = await Payment.find({
        saleId: { $in: saleIds },
      })
        .select("saleId amount")
        .lean();

      totalReceivedForSelectedSales =
        selectedSalePayments.reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0,
        );
    }

    const totalOutstanding = Math.max(
      totalSales - totalReceivedForSelectedSales,
      0,
    );

    /*
     * ---------------------------------------------------------
     * VEHICLE PROFITABILITY
     *
     * For each vehicle sold in the selected period:
     *
     * Vehicle Investment =
     * Purchase Price + vehicle expenses up to sale date
     *
     * Vehicle Profit =
     * Sale Price - Vehicle Investment
     * ---------------------------------------------------------
     */

    const soldVehicleIds = sales
        .map((sale) => sale.vehicleId?._id)
        .filter((id): id is Types.ObjectId => id !== undefined);

    let allRelevantVehicleExpenses: any[] = [];

    if (soldVehicleIds.length > 0) {
      allRelevantVehicleExpenses = await VehicleExpense.find({
        vehicleId: { $in: soldVehicleIds },
      })
        .select("vehicleId amount expenseDate")
        .lean();
    }

    const profitability = sales.map((sale) => {
      const vehicle = sale.vehicleId;

      const purchasePrice = Number(
        vehicle?.purchasePrice || 0,
      );

      const saleDate = new Date(sale.saleDate);

      const vehicleExpenseTotal =
        allRelevantVehicleExpenses
          .filter(
            (expense) =>
              String(expense.vehicleId) ===
                String(vehicle?._id) &&
              new Date(expense.expenseDate) <= saleDate,
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

      return {
        saleId: sale._id,
        vehicle: {
          _id: vehicle?._id,
          name: vehicle?.name,
          model: vehicle?.model,
          year: vehicle?.year,
          chassisNumber: vehicle?.chassisNumber,
          registrationNumber:
            vehicle?.registrationNumber,
        },
        purchasePrice,
        vehicleExpenses: vehicleExpenseTotal,
        investment,
        salePrice: Number(sale.salePrice || 0),
        profit,
        saleDate: sale.saleDate,
      };
    });

    const grossVehicleProfit = profitability.reduce(
      (sum, item) => sum + item.profit,
      0,
    );

    /*
     * General expenses are business-level expenses.
     *
     * They are NOT added to an individual vehicle's investment.
     */
    const businessNetProfit =
      grossVehicleProfit - totalGeneralExpenses;

    return NextResponse.json({
      success: true,

      data: {
        period: {
          from: query.from || null,
          to: query.to || null,
        },

        summary: {
          totalSales,
          totalPayments,
          totalOutstanding,
          totalVehicleExpenses,
          totalGeneralExpenses,

          grossVehicleProfit,
          businessNetProfit,

          salesCount: sales.length,
          paymentCount: payments.length,
          vehicleExpenseCount: vehicleExpenses.length,
          generalExpenseCount: generalExpenses.length,
        },

        sales,

        payments,

        vehicleExpenses,

        generalExpenses,

        profitability,
      },
    });
  } catch (error) {
    console.error("Get reports error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate reports",
      },
      { status: 500 },
    );
  }
}