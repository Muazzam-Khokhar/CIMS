"use client";

import { useCallback, useEffect, useState } from "react";

import {
  BarChart3,
  CarFront,
  CircleDollarSign,
  CreditCard,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

type Summary = {
  totalVehicles: number;
  availableVehicles: number;
  soldVehicles: number;
  discardedVehicles: number;

  totalSales: number;
  totalReceived: number;
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

type RecentSale = {
  _id: string;
  saleType: "CUSTOMER" | "AUCTION";
  salePrice: number;
  saleDate: string;
  totalPaid: number;
  remaining: number;
  paymentStatus: "PAID" | "PARTIAL";
  vehicle: {
    _id: string;
    name: string;
    model: string;
    year: number;
    chassisNumber: string;
  } | null;
};

type RecentPayment = {
  _id: string;
  amount: number;
  paymentDate: string;
  paymentMethod:
    | "CASH"
    | "BANK"
    | "ONLINE"
    | "OTHER";
  notes?: string;
  saleId: {
    _id: string;
    saleType: "CUSTOMER" | "AUCTION";
    salePrice: number;
    vehicleId: {
      _id: string;
      name: string;
      model: string;
      year: number;
      chassisNumber: string;
    };
  };
};

type RecentVehicleExpense = {
  _id: string;
  vehicleId: string;
  title: string;
  amount: number;
  expenseDate: string;
};

type RecentGeneralExpense = {
  _id: string;
  title: string;
  amount: number;
  expenseDate: string;
};

type ProfitabilityItem = {
  saleId: string;
  vehicle: {
    _id: string;
    name: string;
    model: string;
    year: number;
    chassisNumber: string;
  };
  purchasePrice: number;
  vehicleExpenses: number;
  investment: number;
  salePrice: number;
  profit: number;
  saleDate: string;
};

type DashboardData = {
  summary: Summary;
  recentSales: RecentSale[];
  recentPayments: RecentPayment[];
  recentVehicleExpenses: RecentVehicleExpense[];
  recentGeneralExpenses: RecentGeneralExpense[];
  profitability: ProfitabilityItem[];
};

function formatPrice(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(
    "en-PK",
  )}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPaymentMethod(
  method: RecentPayment["paymentMethod"],
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

export default function DashboardPage() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/dashboard");

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to load dashboard",
        );
      }

      setDashboard(result.data);
    } catch (error) {
      console.error(
        "Load dashboard error:",
        error,
      );

      setDashboard(null);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading && !dashboard) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />

          <p className="mt-3 text-sm text-slate-500">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <button
          type="button"
          onClick={loadDashboard}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary } = dashboard;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <BarChart3 className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Dashboard
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Overview of your vehicle business.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* Main KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Available Vehicles"
          value={String(summary.availableVehicles)}
          description={`${summary.totalVehicles} total vehicles`}
          icon={
            <CarFront className="h-5 w-5" />
          }
          iconClass="bg-blue-50 text-blue-600"
        />

        <SummaryCard
          label="Sold Vehicles"
          value={String(summary.soldVehicles)}
          description={`${summary.salesCount} sales recorded`}
          icon={
            <Package className="h-5 w-5" />
          }
          iconClass="bg-violet-50 text-violet-600"
        />

        <SummaryCard
          label="Total Sales"
          value={formatPrice(summary.totalSales)}
          description="Lifetime sales value"
          icon={
            <TrendingUp className="h-5 w-5" />
          }
          iconClass="bg-sky-50 text-sky-600"
        />

        <SummaryCard
          label="Outstanding"
          value={formatPrice(
            summary.totalOutstanding,
          )}
          description="Current receivable"
          icon={
            <Wallet className="h-5 w-5" />
          }
          iconClass="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Financial KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Received"
          value={formatPrice(
            summary.totalReceived,
          )}
          description={`${summary.paymentCount} payments`}
          icon={
            <CircleDollarSign className="h-5 w-5" />
          }
          iconClass="bg-emerald-50 text-emerald-600"
        />

        <SummaryCard
          label="Vehicle Expenses"
          value={formatPrice(
            summary.totalVehicleExpenses,
          )}
          description={`${summary.vehicleExpenseCount} records`}
          icon={
            <CarFront className="h-5 w-5" />
          }
          iconClass="bg-orange-50 text-orange-600"
        />

        <SummaryCard
          label="General Expenses"
          value={formatPrice(
            summary.totalGeneralExpenses,
          )}
          description={`${summary.generalExpenseCount} records`}
          icon={
            <CreditCard className="h-5 w-5" />
          }
          iconClass="bg-rose-50 text-rose-600"
        />

        <SummaryCard
          label="Business Net Profit"
          value={formatPrice(
            summary.businessNetProfit,
          )}
          description="After general expenses"
          icon={
            summary.businessNetProfit >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )
          }
          iconClass={
            summary.businessNetProfit >= 0
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600"
          }
        />
      </div>

      {/* Financial Overview */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Financial Overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Lifetime business performance.
            </p>
          </div>

          <div className="space-y-4">
            <FinancialRow
              label="Sales Revenue"
              value={formatPrice(
                summary.totalSales,
              )}
            />

            <FinancialRow
              label="Total Received"
              value={formatPrice(
                summary.totalReceived,
              )}
              valueClass="text-emerald-600"
            />

            <FinancialRow
              label="Outstanding"
              value={formatPrice(
                summary.totalOutstanding,
              )}
              valueClass="text-amber-600"
            />

            <FinancialRow
              label="Vehicle Expenses"
              value={formatPrice(
                summary.totalVehicleExpenses,
              )}
            />

            <FinancialRow
              label="General Expenses"
              value={formatPrice(
                summary.totalGeneralExpenses,
              )}
            />

            <div className="border-t border-slate-100 pt-4">
              <FinancialRow
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

            <div className="rounded-xl bg-slate-50 px-4 py-4">
              <FinancialRow
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

        {/* Inventory Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Inventory Status
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Current vehicle stock distribution.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <InventoryStat
              label="Available"
              value={summary.availableVehicles}
              className="bg-emerald-50 text-emerald-700"
            />

            <InventoryStat
              label="Sold"
              value={summary.soldVehicles}
              className="bg-blue-50 text-blue-700"
            />

            <InventoryStat
              label="Discarded"
              value={summary.discardedVehicles}
              className="bg-red-50 text-red-700"
            />
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">
                Current stock
              </span>

              <span className="text-sm font-semibold text-slate-900">
                {summary.totalVehicles}
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{
                  width:
                    summary.totalVehicles > 0
                      ? `${
                          (summary.availableVehicles /
                            summary.totalVehicles) *
                          100
                        }%`
                      : "0%",
                }}
              />
            </div>

            <div className="mt-3 flex justify-between text-xs text-slate-400">
              <span>
                {summary.availableVehicles} available
              </span>

              <span>
                {summary.soldVehicles} sold
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales + Payments */}
      <div className="grid gap-5 lg:grid-cols-2">
        <RecentSales sales={dashboard.recentSales} />

        <RecentPayments
          payments={dashboard.recentPayments}
        />
      </div>

      {/* Recent Expenses */}
      <div className="grid gap-5 lg:grid-cols-2">
        <RecentVehicleExpenses
          expenses={dashboard.recentVehicleExpenses}
        />

        <RecentGeneralExpenses
          expenses={dashboard.recentGeneralExpenses}
        />
      </div>

      {/* Vehicle Profitability */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Vehicle Profitability
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Recent realized vehicle profits.
          </p>
        </div>

        {dashboard.profitability.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-sm text-slate-500">
            No sold vehicles yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">
                    Vehicle
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
                {dashboard.profitability
                  .slice(0, 8)
                  .map((item) => (
                    <tr
                      key={item.saleId}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.vehicle.name}{" "}
                          {item.vehicle.model}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.vehicle.year} ·{" "}
                          {item.vehicle.chassisNumber}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-slate-700">
                        {formatPrice(
                          item.investment,
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatPrice(
                          item.salePrice,
                        )}
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
      <div className="flex items-start justify-between gap-4">
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

function FinancialRow({
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

function InventoryStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-4 text-center ${className}`}
    >
      <p className="text-2xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-xs font-medium">
        {label}
      </p>
    </div>
  );
}

function RecentSales({
  sales,
}: {
  sales: RecentSale[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Recent Sales
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Latest vehicle sales.
        </p>
      </div>

      {sales.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">
          No sales yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sales.map((sale) => (
            <div
              key={sale._id}
              className="px-5 py-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {sale.vehicle?.name}{" "}
                    {sale.vehicle?.model}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(sale.saleDate)} ·{" "}
                    {sale.saleType === "CUSTOMER"
                      ? "Customer"
                      : "Auction"}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {formatPrice(sale.salePrice)}
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${
                      sale.paymentStatus ===
                      "PAID"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {sale.paymentStatus ===
                    "PAID"
                      ? "Paid"
                      : "Partial"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentPayments({
  payments,
}: {
  payments: RecentPayment[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Recent Payments
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Latest payments received.
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">
          No payments yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <div
              key={payment._id}
              className="px-5 py-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {payment.saleId?.vehicleId
                      ?.name}{" "}
                    {payment.saleId?.vehicleId
                      ?.model}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(
                      payment.paymentDate,
                    )}{" "}
                    ·{" "}
                    {formatPaymentMethod(
                      payment.paymentMethod,
                    )}
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
  );
}

function RecentVehicleExpenses({
  expenses,
}: {
  expenses: RecentVehicleExpense[];
}) {
  return (
    <ExpensePanel
      title="Recent Vehicle Expenses"
      description="Latest vehicle-related costs."
      expenses={expenses.map((expense) => ({
        _id: expense._id,
        title: expense.title,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
      }))}
    />
  );
}

function RecentGeneralExpenses({
  expenses,
}: {
  expenses: RecentGeneralExpense[];
}) {
  return (
    <ExpensePanel
      title="Recent General Expenses"
      description="Latest business operating costs."
      expenses={expenses}
    />
  );
}

function ExpensePanel({
  title,
  description,
  expenses,
}: {
  title: string;
  description: string;
  expenses: {
    _id: string;
    title: string;
    amount: number;
    expenseDate: string;
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

      {expenses.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">
          No expenses yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {expenses.map((expense) => (
            <div
              key={expense._id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {expense.title}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(expense.expenseDate)}
                </p>
              </div>

              <p className="text-sm font-semibold text-slate-900">
                {formatPrice(expense.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}