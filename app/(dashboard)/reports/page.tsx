"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CalendarDays,
  CarFront,
  CircleDollarSign,
  FileBarChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

type ReportSummary = {
  totalSales: number;
  totalPayments: number;
  totalOutstanding: number;
  totalVehicleExpenses: number;
  totalGeneralExpenses: number;
  grossVehicleProfit: number;
  businessNetProfit: number;
  salesCount: number;
  paymentCount: number;
  vehicleExpenseCount: number;
  generalExpenseCount: number;
};

type Sale = {
  _id: string;
  vehicleId: {
    _id: string;
    name: string;
    model: string;
    year: number;
    color?: string;
    chassisNumber: string;
    registrationNumber?: string;
    purchasePrice?: number;
  };
  saleType: "CUSTOMER" | "AUCTION";
  salePrice: number;
  saleDate: string;
};

type Payment = {
  _id: string;
  saleId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: "CASH" | "BANK" | "ONLINE" | "OTHER";
};

type VehicleExpense = {
  _id: string;
  vehicleId: string;
  title: string;
  amount: number;
  expenseDate: string;
};

type GeneralExpense = {
  _id: string;
  title: string;
  amount: number;
  expenseDate: string;
};

type ProfitabilityItem = {
  saleId: string;
  vehicle: {
    _id: string;
    name?: string;
    model?: string;
    year?: number;
    chassisNumber?: string;
    registrationNumber?: string;
  };
  purchasePrice: number;
  vehicleExpenses: number;
  investment: number;
  salePrice: number;
  profit: number;
  saleDate: string;
};

type ReportData = {
  period: {
    from: string | null;
    to: string | null;
  };
  summary: ReportSummary;
  sales: Sale[];
  payments: Payment[];
  vehicleExpenses: VehicleExpense[];
  generalExpenses: GeneralExpense[];
  profitability: ProfitabilityItem[];
};

function getDefaultFromDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);

  return date.toISOString().split("T")[0];
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function formatPrice(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMethod(
  method: Payment["paymentMethod"],
) {
  switch (method) {
    case "CASH":
      return "Cash";
    case "BANK":
      return "Bank";
    case "ONLINE":
      return "Online";
    case "OTHER":
      return "Other";
  }
}

export default function ReportsPage() {
  const [from, setFrom] = useState(getDefaultFromDate());
  const [to, setTo] = useState(getToday());

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(
    async (fromDate = from, toDate = to) => {
      if (fromDate && toDate && fromDate > toDate) {
        toast.error(
          "The From date cannot be after the To date.",
        );
        return;
      }

      try {
        setLoading(true);

        const params = new URLSearchParams();

        if (fromDate) {
          params.set("from", fromDate);
        }

        if (toDate) {
          params.set("to", toDate);
        }

        const response = await fetch(
          `/api/reports?${params.toString()}`,
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Failed to load report",
          );
        }

        setReport(result.data);
      } catch (error) {
        console.error("Load report error:", error);

        setReport(null);

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load report",
        );
      } finally {
        setLoading(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const summary = report?.summary ?? {
    totalSales: 0,
    totalPayments: 0,
    totalOutstanding: 0,
    totalVehicleExpenses: 0,
    totalGeneralExpenses: 0,
    grossVehicleProfit: 0,
    businessNetProfit: 0,
    salesCount: 0,
    paymentCount: 0,
    vehicleExpenseCount: 0,
    generalExpenseCount: 0,
  };

  const totalExpenses = useMemo(() => {
    return (
      (summary?.totalVehicleExpenses ?? 0) +
      (summary?.totalGeneralExpenses ?? 0)
    );
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <FileBarChart className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Reports
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Business financial performance and profitability.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadReport()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh Report
        </button>
      </div>

      {/* Date Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              From Date
            </label>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              To Date
            </label>

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadReport(from, to)}
            disabled={loading}
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>

        {report?.period && (
          <p className="mt-3 text-xs text-slate-400">
            Report period:{" "}
            <span className="font-medium text-slate-500">
              {report.period.from || "All dates"}
            </span>{" "}
            to{" "}
            <span className="font-medium text-slate-500">
              {report.period.to || "All dates"}
            </span>
          </p>
        )}
      </div>

      {loading && !report ? (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />

            <p className="mt-3 text-sm text-slate-500">
              Generating report...
            </p>
          </div>
        </div>
      ) : !report ? (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <p className="text-sm text-slate-500">
            No report data available.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total Sales"
              value={formatPrice(summary?.totalSales ?? 0)}
              description={`${summary?.salesCount ?? 0} sold vehicle${
                summary?.salesCount === 1 ? "" : "s"
              }`}
              icon={<TrendingUp className="h-5 w-5" />}
              iconClass="bg-blue-50 text-blue-600"
            />

            <SummaryCard
              label="Total Received"
              value={formatPrice(summary?.totalPayments ?? 0)}
              description={`${summary?.paymentCount ?? 0} payment${
                summary?.paymentCount === 1 ? "" : "s"
              }`}
              icon={<CircleDollarSign className="h-5 w-5" />}
              iconClass="bg-emerald-50 text-emerald-600"
            />

            <SummaryCard
              label="Outstanding"
              value={formatPrice(
                summary?.totalOutstanding ?? 0,
              )}
              description="Current receivable"
              icon={<Wallet className="h-5 w-5" />}
              iconClass="bg-amber-50 text-amber-600"
            />

            <SummaryCard
              label="Business Net Profit"
              value={formatPrice(
                summary?.businessNetProfit ?? 0,
              )}
              description="After general expenses"
              icon={
                (summary?.businessNetProfit ?? 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )
              }
              iconClass={
                (summary?.businessNetProfit ?? 0) >= 0
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              }
            />
          </div>

          {/* Financial Breakdown */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Profit Breakdown
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Revenue and vehicle profitability.
                </p>
              </div>

              <div className="space-y-3">
                <ReportRow
                  label="Sales Revenue"
                  value={formatPrice(summary.totalSales)}
                />

                <ReportRow
                  label="Vehicle Expenses"
                  value={formatPrice(
                    summary.totalVehicleExpenses,
                  )}
                />

                <div className="border-t border-slate-100 pt-3">
                  <ReportRow
                    label="Gross Vehicle Profit"
                    value={formatPrice(
                      summary.grossVehicleProfit,
                    )}
                    strong
                    valueClass={
                      summary.grossVehicleProfit >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }
                  />
                </div>

                <ReportRow
                  label="General Expenses"
                  value={formatPrice(
                    summary.totalGeneralExpenses,
                  )}
                />

                <div className="border-t border-slate-100 pt-3">
                  <ReportRow
                    label="Business Net Profit"
                    value={formatPrice(
                      summary.businessNetProfit,
                    )}
                    strong
                    valueClass={
                      summary.businessNetProfit >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Expense Breakdown
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Vehicle-specific vs business-level expenses.
                </p>
              </div>

              <div className="space-y-4">
                <ExpenseBreakdownRow
                  icon={<CarFront className="h-4 w-4" />}
                  label="Vehicle Expenses"
                  count={summary.vehicleExpenseCount}
                  amount={summary.totalVehicleExpenses}
                  total={totalExpenses}
                />

                <ExpenseBreakdownRow
                  icon={<Wallet className="h-4 w-4" />}
                  label="General Expenses"
                  count={summary.generalExpenseCount}
                  amount={summary.totalGeneralExpenses}
                  total={totalExpenses}
                />

                <div className="rounded-xl bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      Total Expenses
                    </span>

                    <span className="text-base font-bold text-slate-900">
                      {formatPrice(totalExpenses)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Profitability */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Vehicle Profitability
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Investment and realized profit for vehicles sold
                  in the selected period.
                </p>
              </div>
            </div>

            {report.profitability.length === 0 ? (
              <div className="flex h-48 items-center justify-center px-5 text-center">
                <p className="text-sm text-slate-500">
                  No sold vehicles found for this period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px]">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-4">
                        Vehicle
                      </th>
                      <th className="px-5 py-4">
                        Purchase
                      </th>
                      <th className="px-5 py-4">
                        Vehicle Expenses
                      </th>
                      <th className="px-5 py-4">
                        Investment
                      </th>
                      <th className="px-5 py-4">
                        Sale
                      </th>
                      <th className="px-5 py-4">
                        Profit
                      </th>
                      <th className="px-5 py-4">
                        Sale Date
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {report.profitability.map((item) => (
                      <tr
                        key={item.saleId}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                              <CarFront className="h-5 w-5" />
                            </div>

                            <div>
                              <p className="font-semibold text-slate-900">
                                {item.vehicle?.name}{" "}
                                {item.vehicle?.model}
                              </p>

                              <p className="text-xs text-slate-500">
                                {item.vehicle?.year} ·{" "}
                                {item.vehicle?.chassisNumber}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {formatPrice(item.purchasePrice)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {formatPrice(
                            item.vehicleExpenses,
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {formatPrice(item.investment)}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {formatPrice(item.salePrice)}
                        </td>

                        <td
                          className={`px-5 py-4 text-sm font-bold ${
                            item.profit >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatPrice(item.profit)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(item.saleDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sales + Payments */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Recent Sales */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Sales in Period
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {report.sales.length} sale
                  {report.sales.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                {report.sales.length === 0 ? (
                  <div className="flex h-40 items-center justify-center px-5 text-sm text-slate-500">
                    No sales found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {report.sales.map((sale) => (
                      <div
                        key={sale._id}
                        className="px-5 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {sale.vehicleId?.name}{" "}
                              {sale.vehicleId?.model}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(sale.saleDate)} ·{" "}
                              {sale.saleType === "CUSTOMER"
                                ? "Customer"
                                : "Auction"}
                            </p>
                          </div>

                          <p className="text-sm font-bold text-slate-900">
                            {formatPrice(sale.salePrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Payments */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Payments in Period
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {report.payments.length} payment
                  {report.payments.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                {report.payments.length === 0 ? (
                  <div className="flex h-40 items-center justify-center px-5 text-sm text-slate-500">
                    No payments found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {report.payments.map((payment) => (
                      <div
                        key={payment._id}
                        className="px-5 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {formatMethod(
                                payment.paymentMethod,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(payment.paymentDate)}
                            </p>
                          </div>

                          <p className="text-sm font-bold text-emerald-600">
                            {formatPrice(payment.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Expense Records */}
          <div className="grid gap-5 lg:grid-cols-2">
            <ExpenseList
              title="Vehicle Expense Records"
              description={`${report.vehicleExpenses.length} record${
                report.vehicleExpenses.length !== 1
                  ? "s"
                  : ""
              }`}
              items={report.vehicleExpenses.map((expense) => ({
                id: expense._id,
                title: expense.title,
                amount: expense.amount,
                date: expense.expenseDate,
              }))}
            />

            <ExpenseList
              title="General Expense Records"
              description={`${report.generalExpenses.length} record${
                report.generalExpenses.length !== 1
                  ? "s"
                  : ""
              }`}
              items={report.generalExpenses.map((expense) => ({
                id: expense._id,
                title: expense.title,
                amount: expense.amount,
                date: expense.expenseDate,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function ReportRow({
  label,
  value,
  strong = false,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`text-sm ${
          strong
            ? "font-semibold text-slate-800"
            : "text-slate-500"
        }`}
      >
        {label}
      </span>

      <span
        className={`text-sm ${
          strong ? "font-bold" : "font-semibold"
        } ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function ExpenseBreakdownRow({
  icon,
  label,
  count,
  amount,
  total,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  amount: number;
  total: number;
}) {
  const percentage =
    total > 0 ? Math.round((amount / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {icon}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">
              {label}
            </p>

            <p className="text-xs text-slate-400">
              {count} record{count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">
            {formatPrice(amount)}
          </p>

          <p className="text-xs text-slate-400">
            {percentage}%
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ExpenseList({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: {
    id: string;
    title: string;
    amount: number;
    date: string;
  }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="max-h-[350px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-5 text-sm text-slate-500">
            No expense records found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {item.title}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(item.date)}
                  </p>
                </div>

                <p className="text-sm font-semibold text-slate-900">
                  {formatPrice(item.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}