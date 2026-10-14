import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vehicle from "@/models/Vehicle";
import Sale from "@/models/Sale";
import Payment from "@/models/Payment";
import VehicleExpense from "@/models/VehicleExpense";
import GeneralExpense from "@/models/GeneralExpense";
import Loan from "@/models/Loan";
import FinanceTransaction from "@/models/FinanceTransaction";
import { SIGNED_AMOUNT, netPaidBySale } from "@/lib/paymentTotals";

async function total(
  model: any,
  match: Record<string, unknown> = {},
  field = "amount",
) {
  const rows = await model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]);
  return Number(rows[0]?.total || 0);
}

async function netPayments() {
  const rows = await Payment.aggregate([
    { $group: { _id: null, total: { $sum: SIGNED_AMOUNT } } },
  ]);
  return Number(rows[0]?.total || 0);
}

export async function computeMoneyOverview() {
  await connectDB();

  const [
    paymentsNet,
    saleReturnRefunds,
    vehiclesBought,
    vehicleExpenses,
    generalExpenses,
    txRows,
    activeSales,
    loans,
    loanRepaidRows,
    advances,
    settledRows,
  ] = await Promise.all([
    netPayments(),
    total(Sale, { status: "RETURNED" }, "refundAmount"),
    total(Vehicle, {}, "purchasePrice"),
    total(VehicleExpense),
    total(GeneralExpense),
    FinanceTransaction.aggregate([
      { $match: { status: "VALID" } },
      {
        $group: {
          _id: { type: "$type", settlement: "$settlementType" },
          total: { $sum: "$amount" },
        },
      },
    ]),
    Sale.find({ status: { $ne: "RETURNED" } })
      .select("salePrice")
      .lean(),
    Loan.find({ status: { $ne: "VOIDED" } })
      .select("direction counterpartyName principalAmount")
      .lean(),
    FinanceTransaction.aggregate([
      {
        $match: {
          status: "VALID",
          type: { $in: ["LOAN_PRINCIPAL_REPAYMENT", "PARTNER_ADVANCE_REPAID"] },
        },
      },
      { $group: { _id: "$loanId", total: { $sum: "$amount" } } },
    ]),
    FinanceTransaction.find({ type: "BUSINESS_ADVANCE_GIVEN", status: "VALID" })
      .populate("partnerId", "name")
      .lean(),
    FinanceTransaction.aggregate([
      { $match: { status: "VALID", type: "BUSINESS_ADVANCE_SETTLED" } },
      { $group: { _id: "$relatedTransactionId", total: { $sum: "$amount" } } },
    ]),
  ]);

  const t = (type: string) =>
    txRows
      .filter((r: any) => r._id.type === type)
      .reduce((s: number, r: any) => s + r.total, 0);

  /* Customers still owe you */
  const paidBySale = await netPaidBySale(activeSales.map((s: any) => s._id));
  const customersOwe = activeSales.reduce(
    (sum: number, sale: any) =>
      sum +
      Math.max(Number(sale.salePrice) - (paidBySale.get(String(sale._id)) || 0), 0),
    0,
  );

  /* Loans */
  const repaidByLoan = new Map(
    loanRepaidRows.map((r: any) => [String(r._id), r.total as number]),
  );
  let youOwe = 0;
  let partnersOweLoans = 0;
  const openLoans: {
    _id: string;
    direction: string;
    name: string;
    outstanding: number;
  }[] = [];

  for (const loan of loans as any[]) {
    const outstanding = Math.max(
      Number(loan.principalAmount) - (repaidByLoan.get(String(loan._id)) || 0),
      0,
    );
    if (outstanding <= 0.005) continue;

    if (loan.direction === "BUSINESS_BORROWED") youOwe += outstanding;
    else partnersOweLoans += outstanding;

    openLoans.push({
      _id: String(loan._id),
      direction: loan.direction,
      name: loan.counterpartyName,
      outstanding,
    });
  }

  /* Business cash held by partners */
  const settledByAdvance = new Map(
    settledRows.map((r: any) => [String(r._id), r.total as number]),
  );
  const openAdvances = (advances as any[])
    .map((a) => ({
      _id: String(a._id),
      partnerName: a.partnerId?.name || "Partner",
      remaining: a.amount - (settledByAdvance.get(String(a._id)) || 0),
    }))
    .filter((a) => a.remaining > 0.005);

  const stillWithPartners = openAdvances.reduce((s, a) => s + a.remaining, 0);

  /* Money in / out */
  const moneyIn = {
    fromCustomers: paymentsNet - saleReturnRefunds, // received minus all returns
    partnersPutIn: t("PARTNER_CONTRIBUTION"),
    borrowed: t("LOAN_RECEIVED"),
    lentBackByPartners: t("PARTNER_ADVANCE_REPAID"),
  };

  const moneyOut = {
    carsBought: vehiclesBought,
    carExpenses: vehicleExpenses,
    generalExpenses,
    partnersMoneyReturned: t("PARTNER_CAPITAL_RETURN"),
    partnersPersonalUse: t("PARTNER_DRAWING"),
    loansPaidBack: t("LOAN_PRINCIPAL_REPAYMENT"),
    lentToPartners: t("PARTNER_ADVANCE_GIVEN"),
    stillWithPartners,
  };

  const sumOf = (o: Record<string, number>) =>
    Object.values(o).reduce((a, b) => a + b, 0);

  return {
    cashEstimate: sumOf(moneyIn) - sumOf(moneyOut),
    moneyIn,
    moneyOut,
    customersOwe,
    partnersOweLoans,
    stillWithPartners,
    youOwe,
    openLoans,
    openAdvances,
  };
}

export async function getMoneyOverview() {
  try {
    return NextResponse.json({
      success: true,
      data: await computeMoneyOverview(),
    });
  } catch (error) {
    console.error("Money overview error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load money overview" },
      { status: 500 },
    );
  }
}