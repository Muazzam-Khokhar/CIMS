"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CarFront,
  CircleDollarSign,
  Eye,
  RefreshCw,
  Search,
  TrendingUp,
  Pencil,
  Trash,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
import { ReturnSaleModal } from "@/components/ReturnSaleModal";
import Link from "next/link";

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

  totalPaid: number;
  remaining: number;
  paymentStatus: "PAID" | "PARTIAL" | "RETURNED";
  status?: "ACTIVE" | "RETURNED";
  returnDate?: string;
  refundAmount?: number;
  returnReason?: string;

  createdAt: string;
};

type Payment = {
  _id: string;
  saleId: {
    _id: string;
  };
  type?: "RECEIVED" | "REFUND";
  amount: number;
  paymentDate: string;
  paymentMethod: "CASH" | "BANK" | "ONLINE" | "OTHER";
  notes?: string;
  createdAt: string;
};

type SaleTotals = {
  totalSales: number;
  totalPaid: number;
  totalRemaining: number;
};

const todayString = () => new Date().toISOString().split("T")[0];

const formatPrice = (value: number) => {
  return `¥. ${value.toLocaleString("en-JP")}`;
};

const formatDate = (value: string) => {
  return new Date(value).toLocaleDateString("en-JP", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatPaymentMethod = (method: Payment["paymentMethod"]) => {
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
};

const statusBadge = (status: Sale["paymentStatus"]) => {
  switch (status) {
    case "PAID":
      return { label: "Paid", className: "bg-emerald-50 text-emerald-700" };
    case "RETURNED":
      return { label: "Returned", className: "bg-red-50 text-red-700" };
    default:
      return { label: "Partial", className: "bg-amber-50 text-amber-700" };
  }
};

export default function SalesPage() {
  const confirm = useConfirm();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CUSTOMER" | "AUCTION">(
    "ALL"
  );
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "RETURNED">(
    "ACTIVE"
  );
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [salePayments, setSalePayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: todayString(),
    paymentMethod: "CASH" as Payment["paymentMethod"],
    notes: "",
  });

  const [addingPayment, setAddingPayment] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [totals, setTotals] = useState<SaleTotals>({
    totalSales: 0,
    totalPaid: 0,
    totalRemaining: 0,
  });

  const loadData = useCallback(async (): Promise<Sale[]> => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (typeFilter !== "ALL") {
        params.set("saleType", typeFilter);
      }

      params.set("status", statusFilter);

      const response = await fetch(`/api/sales?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load sales");
      }

      const data: Sale[] = result.data ?? [];

      setSales(data);
      setTotalCount(result.totalCount ?? 0);
      setHasMore(result.hasMore ?? false);
      setTotals({
        totalSales: result.totals?.totalSales ?? 0,
        totalPaid: result.totals?.totalPaid ?? 0,
        totalRemaining: result.totals?.totalRemaining ?? 0,
      });

      return data;
    } catch (error) {
      console.error("Load sales error:", error);
      setSales([]);
      setTotalCount(0);
      setHasMore(false);
      setTotals({ totalSales: 0, totalPaid: 0, totalRemaining: 0 });

      toast.error(
        error instanceof Error ? error.message : "Failed to load sales"
      );

      return [];
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, typeFilter, statusFilter]);

  const loadSalePayments = async (saleId: string) => {
    try {
      setPaymentsLoading(true);

      // saleId param needs backend support in getPayments (see note);
      // the client-side filter below is kept as a safety net.
      const response = await fetch(
        `/api/payments?saleId=${saleId}&limit=100`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load payment history");
      }

      const allPayments: Payment[] = result.data ?? [];

      const filtered = allPayments.filter(
        (payment) => payment.saleId?._id === saleId
      );

      setSalePayments(filtered);
    } catch (error) {
      console.error("Load sale payments error:", error);

      setSalePayments([]);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load payment history"
      );
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter]);

  const resetPaymentForm = () => {
    setEditingPaymentId(null);
    setShowPaymentForm(false);
    setPaymentForm({
      amount: "",
      paymentDate: todayString(),
      paymentMethod: "CASH",
      notes: "",
    });
  };

  const openSaleDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    resetPaymentForm();
    await loadSalePayments(sale._id);
  };

  const closeSaleDetails = () => {
    if (addingPayment) return;

    setSelectedSale(null);
    setSalePayments([]);
    setReturnOpen(false);
    resetPaymentForm();
  };

  const refreshSelected = async (saleId: string) => {
    const updatedSales = await loadData();
    const updatedSale = updatedSales.find((s) => s._id === saleId);
    if (updatedSale) setSelectedSale(updatedSale);
    await loadSalePayments(saleId);
  };

  const startEditPayment = (payment: Payment) => {
    setEditingPaymentId(payment._id);
    setPaymentForm({
      amount: String(payment.amount),
      paymentDate: new Date(payment.paymentDate).toISOString().split("T")[0],
      paymentMethod: payment.paymentMethod,
      notes: payment.notes || "",
    });
    setShowPaymentForm(true);
  };

  const handleSavePayment = async () => {
    if (!selectedSale) return;

    const amount = Number(paymentForm.amount);
    const editing = salePayments.find((p) => p._id === editingPaymentId);
    const maxAllowed = selectedSale.remaining + (editing?.amount ?? 0);

    if (!amount || amount <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    if (amount > maxAllowed) {
      toast.error(`Payment cannot be greater than ${formatPrice(maxAllowed)}.`);
      return;
    }

    if (!paymentForm.paymentDate) {
      toast.error("Please select the payment date.");
      return;
    }

    try {
      setAddingPayment(true);

      const response = await fetch(
        editingPaymentId
          ? `/api/payments/${editingPaymentId}`
          : "/api/payments",
        {
          method: editingPaymentId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(editingPaymentId ? {} : { saleId: selectedSale._id }),
            amount,
            paymentDate: paymentForm.paymentDate,
            paymentMethod: paymentForm.paymentMethod,
            notes: paymentForm.notes.trim() || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save payment");
      }

      toast.success(
        editingPaymentId ? "Payment updated." : "Payment added successfully."
      );
      resetPaymentForm();
      await refreshSelected(selectedSale._id);
    } catch (error) {
      console.error("Save payment error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save payment"
      );
    } finally {
      setAddingPayment(false);
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (!selectedSale) return;

    const confirmed = await confirm({
      title: "Delete this payment?",
      description: `Delete the payment of ${formatPrice(
        payment.amount
      )}? The remaining amount will increase.`,
      confirmText: "Delete",
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/payments/${payment._id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete payment");
      }

      toast.success("Payment deleted.");
      await refreshSelected(selectedSale._id);
    } catch (error) {
      console.error("Delete payment error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete payment"
      );
    }
  };

  const isReturned = selectedSale?.status === "RETURNED";
  const editingAmount =
    salePayments.find((p) => p._id === editingPaymentId)?.amount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales</h1>

          <p className="mt-1 text-sm text-slate-500">
            Track sold vehicles, payments and outstanding amounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Sales</p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatPrice(totals.totalSales)}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Received</p>

              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {formatPrice(totals.totalPaid)}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Outstanding</p>

              <p className="mt-2 text-2xl font-bold text-amber-600">
                {formatPrice(totals.totalRemaining)}
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle, model, chassis..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as "ALL" | "CUSTOMER" | "AUCTION")
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">All Sale Types</option>
            <option value="CUSTOMER">Customer</option>
            <option value="AUCTION">Auction</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "ACTIVE" | "RETURNED")
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
          >
            <option value="ACTIVE">Active sales</option>
            <option value="RETURNED">Returned</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Vehicle</th>
                <th className="px-5 py-4">Sale Type</th>
                <th className="px-5 py-4">Sale Price</th>
                <th className="px-5 py-4">Paid</th>
                <th className="px-5 py-4">Remaining</th>
                <th className="px-5 py-4">Sale Date</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading sales...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No sales found.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const vehicle = sale.vehicleId;
                  const badge = statusBadge(sale.paymentStatus);

                  return (
                    <tr
                      key={sale._id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <CarFront className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">
                              {vehicle?.name} {vehicle?.model}
                            </p>

                            <p className="text-xs text-slate-500">
                              {vehicle?.year} · {vehicle?.chassisNumber}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            sale.saleType === "CUSTOMER"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {sale.saleType === "CUSTOMER"
                            ? "Customer"
                            : "Auction"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatPrice(sale.salePrice)}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-emerald-600">
                        {formatPrice(sale.totalPaid)}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-amber-600">
                        {formatPrice(sale.remaining)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(sale.saleDate)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void openSaleDetails(sale)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          title="View sale"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {totalCount === 0
            ? "No sales to display"
            : `Showing ${(page - 1) * limit + 1}–${Math.min(
                (page - 1) * limit + sales.length,
                totalCount
              )} of ${totalCount} sales`}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <span className="px-2 text-sm font-medium text-slate-600">
            Page {page}
          </span>

          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasMore || loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Sale Details */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Sale Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedSale.vehicleId?.name} {selectedSale.vehicleId?.model}
                </p>
              </div>

              <button
                type="button"
                onClick={closeSaleDetails}
                disabled={addingPayment}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6">
              {isReturned && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Returned on{" "}
                  {selectedSale.returnDate
                    ? formatDate(selectedSale.returnDate)
                    : "—"}
                  . Refunded {formatPrice(selectedSale.refundAmount ?? 0)}.
                  {selectedSale.returnReason
                    ? ` Reason: ${selectedSale.returnReason}`
                    : ""}
                </div>
              )}

              {/* Sale Summary */}
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  label="Sale Type"
                  value={
                    selectedSale.saleType === "CUSTOMER"
                      ? "Customer"
                      : "Auction"
                  }
                />

                <DetailRow
                  label="Sale Price"
                  value={formatPrice(selectedSale.salePrice)}
                />

                <DetailRow
                  label="Total Paid"
                  value={formatPrice(selectedSale.totalPaid)}
                />

                <DetailRow
                  label="Remaining"
                  value={formatPrice(selectedSale.remaining)}
                />

                <DetailRow
                  label="Sale Date"
                  value={formatDate(selectedSale.saleDate)}
                />

                <DetailRow
                  label="Chassis Number"
                  value={selectedSale.vehicleId?.chassisNumber || "—"}
                />
              </div>

              {/* Payment History */}
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Payment History
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {salePayments.length} payment
                      {salePayments.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    {!isReturned && selectedSale.remaining > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (showPaymentForm) {
                            resetPaymentForm();
                          } else {
                            setShowPaymentForm(true);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Plus className="h-4 w-4" />

                        {showPaymentForm ? "Close Payment Form" : "Add Payment"}
                      </button>
                    )}
                    {!isReturned && selectedSale.totalPaid > 0 && (
                      <Link
                        href={`/payments?returnSale=${selectedSale._id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Return payment
                      </Link>
                    )}
                  </div>
                </div>

                {/* Add / Edit Payment Form */}
                {showPaymentForm && !isReturned && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {editingPaymentId ? "Edit Payment" : "Add Payment"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {editingPaymentId ? "Maximum allowed" : "Remaining amount"}
                        :{" "}
                        <span className="font-semibold text-amber-600">
                          {formatPrice(selectedSale.remaining + editingAmount)}
                        </span>
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Amount */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Payment Amount
                        </label>

                        <input
                          type="number"
                          min="0.01"
                          max={selectedSale.remaining + editingAmount}
                          step="0.01"
                          value={paymentForm.amount}
                          onChange={(e) =>
                            setPaymentForm((current) => ({
                              ...current,
                              amount: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Payment Date
                        </label>

                        <input
                          type="date"
                          value={paymentForm.paymentDate}
                          onChange={(e) =>
                            setPaymentForm((current) => ({
                              ...current,
                              paymentDate: e.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </div>

                      {/* Method */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Payment Method
                        </label>

                        <select
                          value={paymentForm.paymentMethod}
                          onChange={(e) =>
                            setPaymentForm((current) => ({
                              ...current,
                              paymentMethod: e.target
                                .value as Payment["paymentMethod"],
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        >
                          <option value="CASH">Cash</option>
                          <option value="BANK">Bank</option>
                          <option value="ONLINE">Online</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Notes
                          <span className="ml-1 font-normal text-slate-400">
                            (optional)
                          </span>
                        </label>

                        <input
                          type="text"
                          value={paymentForm.notes}
                          onChange={(e) =>
                            setPaymentForm((current) => ({
                              ...current,
                              notes: e.target.value,
                            }))
                          }
                          placeholder="Payment details..."
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={resetPaymentForm}
                        disabled={addingPayment}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleSavePayment()}
                        disabled={addingPayment}
                        className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {addingPayment
                          ? "Saving..."
                          : editingPaymentId
                            ? "Update Payment"
                            : "Save Payment"}
                      </button>
                    </div>
                  </div>
                )}

                {/* History List */}
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  {paymentsLoading ? (
                    <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                      Loading payment history...
                    </div>
                  ) : salePayments.length === 0 ? (
                    <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                      No payments recorded for this sale.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {salePayments.map((payment) => (
                        <div
                          key={payment._id}
                          className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold ${payment.type === "REFUND" ? "text-red-600" : "text-slate-900"}`}>
                              {payment.type === "REFUND" ? "−" : ""}{formatPrice(payment.amount)}
                            </p>
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                              {payment.type === "REFUND"
                                ? "Returned to customer"
                                : formatPaymentMethod(payment.paymentMethod)}
                            </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(payment.paymentDate)}
                            </p>

                            {payment.notes && (
                              <p className="mt-1 text-xs text-slate-400">
                                {payment.notes}
                              </p>
                            )}
                          </div>

                          {!isReturned && (
                            <div className="flex gap-1">
                              {payment.type !== "REFUND" && (
                                <button
                                  type="button"
                                  onClick={() => startEditPayment(payment)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  title="Edit payment"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => void handleDeletePayment(payment)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                                title="Delete payment"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <p className="text-xs text-slate-500">Payment Status</p>

                <span
                  className={`mt-1 inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    statusBadge(selectedSale.paymentStatus).className
                  }`}
                >
                  {statusBadge(selectedSale.paymentStatus).label}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {!isReturned && (
                  <button
                    type="button"
                    onClick={() => setReturnOpen(true)}
                    className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Return Sale
                  </button>
                )}

                <div className="text-right">
                  <p className="text-xs text-slate-500">Remaining</p>

                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatPrice(selectedSale.remaining)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Sale Modal */}
      {selectedSale && (
        <ReturnSaleModal
          open={returnOpen}
          saleId={selectedSale._id}
          vehicleLabel={`${selectedSale.vehicleId?.name} ${selectedSale.vehicleId?.model}`}
          totalPaid={selectedSale.totalPaid}
          onClose={() => setReturnOpen(false)}
          onSuccess={async () => {
            closeSaleDetails();
            await loadData();
          }}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>

      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}