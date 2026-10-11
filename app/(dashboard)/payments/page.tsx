"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CarFront,
  CircleDollarSign,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";


type Vehicle = {
  _id: string;
  name: string;
  model: string;
  year: number;
  chassisNumber: string;
};

type Sale = {
  _id: string;
  vehicleId: Vehicle;
  saleType: "CUSTOMER" | "AUCTION";
  salePrice: number;
  saleDate: string;
};

type Payment = {
  _id: string;
  saleId: Sale;
  amount: number;
  paymentDate: string;
  paymentMethod: "CASH" | "BANK" | "ONLINE" | "OTHER";
  notes?: string;
  createdAt: string;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [methodFilter, setMethodFilter] = useState<
    "ALL" | Payment["paymentMethod"]
  >("ALL");

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
  
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: search.trim(),
        paymentMethod: methodFilter,
      });
  
      const response = await fetch(`/api/payments?${params.toString()}`);
      const result = await response.json();
  
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load payments");
      }
  
      setPayments(result.data ?? []);
      setTotalCount(result.totalCount ?? 0);
      setTotalPayments(result.totals?.totalAmount ?? 0);
      setTotalPages(Math.ceil((result.totalCount ?? 0) / limit));
    } catch (error) {
      console.error("Load payments error:", error);
      setPayments([]);
  
      toast.error(
        error instanceof Error ? error.message : "Failed to load payments",
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, methodFilter]);
  
  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);


  const formatPrice = (value: number) => {
    return `Rs. ${value.toLocaleString("en-PK")}`;
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getMethodLabel = (
    method: Payment["paymentMethod"]
  ) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Payments
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Track all payments received against vehicle sales.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPayments}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* Summary */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Total Payments Received
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {formatPrice(totalPayments)}
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
            <CircleDollarSign className="h-5 w-5" />
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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search vehicle, model, chassis..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(
                e.target.value as "ALL" | Payment["paymentMethod"],
              );
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="ONLINE">Online</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Vehicle</th>
                <th className="px-5 py-4">Sale Type</th>
                <th className="px-5 py-4">Payment</th>
                <th className="px-5 py-4">Method</th>
                <th className="px-5 py-4">Payment Date</th>
                <th className="px-5 py-4">Sale Price</th>
                <th className="px-5 py-4">Notes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No payments found.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  const vehicle =
                    payment.saleId?.vehicleId;

                  return (
                    <tr
                      key={payment._id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <CarFront className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">
                              {vehicle?.name}{" "}
                              {vehicle?.model}
                            </p>

                            <p className="text-xs text-slate-500">
                              {vehicle?.year} ·{" "}
                              {vehicle?.chassisNumber}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            payment.saleId?.saleType ===
                            "CUSTOMER"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {payment.saleId?.saleType ===
                          "CUSTOMER"
                            ? "Customer"
                            : "Auction"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm font-bold text-emerald-600">
                        {formatPrice(payment.amount)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {getMethodLabel(
                            payment.paymentMethod
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(payment.paymentDate)}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-slate-900">
                        {formatPrice(
                          payment.saleId?.salePrice ?? 0
                        )}
                      </td>

                      <td className="max-w-[220px] px-5 py-4 text-sm text-slate-500">
                        <span className="line-clamp-2">
                          {payment.notes || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {totalCount === 0
                ? "No payments"
                : `Showing ${(page - 1) * limit + 1}–${Math.min(
                    page * limit,
                    totalCount,
                  )} of ${totalCount} payments`}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loading || page <= 1}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <span className="px-2 text-sm text-slate-600">
                Page {page} of {Math.max(1, totalPages)}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={loading || page >= totalPages || totalCount === 0}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}