"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CarFront,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  RefreshCw,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";

type Vehicle = { name: string; model: string; year?: number; chassisNumber: string };

type Payment = {
  _id: string;
  saleId: {
    _id: string;
    vehicleId: Vehicle;
    saleType: "CUSTOMER" | "AUCTION";
    salePrice: number;
  } | null;
  type?: "RECEIVED" | "REFUND";
  amount: number;
  paymentDate: string;
  paymentMethod: "CASH" | "BANK" | "ONLINE" | "OTHER";
  notes?: string;
};

type SaleOption = {
  _id: string;
  salePrice: number;
  totalPaid: number;
  vehicleId: Vehicle;
};

const METHODS = [
  ["CASH", "Cash"],
  ["BANK", "Bank transfer"],
  ["ONLINE", "Online / mobile app"],
  ["OTHER", "Other"],
] as const;

const methodLabel = (m: string) => METHODS.find((x) => x[0] === m)?.[1] ?? m;

function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const emptyForm = () => ({ amount: "", date: todayStr(), method: "CASH", notes: "" });

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "RECEIVED" | "REFUND">("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");

  const [page, setPage] = useState(1);
  const limit = 10;
  const [totalCount, setTotalCount] = useState(0);
  const [totals, setTotals] = useState({ received: 0, returned: 0, net: 0 });
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  /* return-payment modal */
  const [refundOpen, setRefundOpen] = useState(false);
  const [sale, setSale] = useState<SaleOption | null>(null);
  const [saleSearch, setSaleSearch] = useState("");
  const [results, setResults] = useState<SaleOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debounced,
        paymentMethod: methodFilter,
        type: typeFilter,
      });

      const res = await fetch(`/api/payments?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setPayments(json.data ?? []);
      setTotalCount(json.totalCount ?? 0);
      setTotals(json.totals ?? { received: 0, returned: 0, net: 0 });
    } catch (e) {
      setPayments([]);
      toast.error(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [page, debounced, methodFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------------------- return-payment flow ---------------------- */

  const openRefund = useCallback(async (saleId?: string) => {
    setForm(emptyForm());
    setSale(null);
    setSaleSearch("");
    setResults([]);
    setRefundOpen(true);

    if (!saleId) return;

    try {
      const res = await fetch(`/api/sales?saleId=${saleId}&limit=1`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success && json.data?.[0]) setSale(json.data[0]);
    } catch {
      /* the user can still search for the sale */
    }
  }, []);

  // Opened from the Sales page: /payments?returnSale=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("returnSale");
    if (id) {
      void openRefund(id);
      window.history.replaceState(null, "", "/payments");
    }
  }, [openRefund]);

  // Search sales that have money to give back
  useEffect(() => {
    if (!refundOpen || sale) return;

    const t = setTimeout(async () => {
      try {
        setSearching(true);
        const params = new URLSearchParams({
          page: "1",
          limit: "20",
          status: "ACTIVE",
          search: saleSearch.trim(),
        });
        const res = await fetch(`/api/sales?${params}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        setResults((json.data ?? []).filter((s: SaleOption) => s.totalPaid > 0));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [refundOpen, sale, saleSearch]);

  const closeRefund = () => {
    if (saving) return;
    setRefundOpen(false);
  };

  async function submitRefund() {
    if (!sale) {
      toast.error("Please choose the car.");
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter the amount.");
      return;
    }
    if (amount > sale.totalPaid + 0.005) {
      toast.error(`You can return at most ${formatMoney(sale.totalPaid)}.`);
      return;
    }
    if (!form.date) {
      toast.error("Please choose the date.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale._id,
          type: "REFUND",
          amount,
          paymentDate: form.date,
          paymentMethod: form.method,
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success(`${formatMoney(amount)} returned. The customer's balance went up by that amount.`);
      setRefundOpen(false);
      setPage(1);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not return the payment");
    } finally {
      setSaving(false);
    }
  }

  const carName = (v?: Vehicle) => (v ? `${v.name} ${v.model}`.trim() : "—");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Money received from customers, and money you gave back.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void openRefund()}
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
          >
            <Undo2 className="h-4 w-4" />
            Return payment
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Received" value={formatMoney(totals.received)} tone="text-emerald-600" />
        <SummaryCard label="Returned to customers" value={formatMoney(totals.returned)} tone="text-red-600" />
        <SummaryCard label="Kept (received − returned)" value={formatMoney(totals.net)} tone="text-slate-900" />
      </div>
      <p className="-mt-3 text-xs text-slate-400">
        Totals follow your search and filters. Money refunded when a whole sale is cancelled is shown on the Sales page under “Returned”.
      </p>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search car, model, chassis..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as typeof typeFilter);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">Received and returned</option>
            <option value="RECEIVED">Received only</option>
            <option value="REFUND">Returned only</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">Any method</option>
            {METHODS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-4">Car</th>
                <th className="px-5 py-4">What happened</th>
                <th className="px-5 py-4">Amount</th>
                <th className="px-5 py-4">Method</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Notes</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                    No payments found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const refund = p.type === "REFUND";
                  const v = p.saleId?.vehicleId;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <CarFront className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{carName(v)}</p>
                            <p className="text-xs text-slate-500">
                              {v?.chassisNumber || "—"}
                              {p.saleId ? ` · Sold for ${formatMoney(p.saleId.salePrice)}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            refund ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {refund ? "Returned to customer" : "Payment received"}
                        </span>
                      </td>

                      <td className={`px-5 py-4 text-sm font-bold ${refund ? "text-red-600" : "text-emerald-600"}`}>
                        {refund ? "−" : "+"}
                        {formatMoney(p.amount)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">{methodLabel(p.paymentMethod)}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{formatDate(p.paymentDate)}</td>

                      <td className="max-w-[220px] px-5 py-4 text-sm text-slate-500">
                        <span className="line-clamp-2">{p.notes || "—"}</span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {!refund && p.saleId && (
                          <button
                            type="button"
                            onClick={() => void openRefund(p.saleId!._id)}
                            title="Return money to this customer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {totalCount === 0
              ? "No payments"
              : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount}`}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((c) => Math.max(1, c - 1))}
              disabled={loading || page <= 1}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="px-2 text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
              disabled={loading || page >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Return payment modal */}
      {refundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Return payment</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Give money back to a customer
                </p>
              </div>
              <button
                type="button"
                onClick={closeRefund}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Step 1: choose the car */}
              {!sale ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Which car was the payment for?
                  </label>
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      autoFocus
                      value={saleSearch}
                      onChange={(e) => setSaleSearch(e.target.value)}
                      placeholder="Search car, model or chassis..."
                      className="h-11 w-full rounded-xl border border-slate-200 pr-3 pl-9 text-sm outline-none focus:border-sky-400"
                    />
                  </div>

                  <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                    {searching ? (
                      <p className="px-3 py-6 text-center text-xs text-slate-400">Searching...</p>
                    ) : results.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-slate-400">
                        No sold car with a payment found.
                      </p>
                    ) : (
                      results.map((s) => (
                        <button
                          key={s._id}
                          type="button"
                          onClick={() => setSale(s)}
                          className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {carName(s.vehicleId)}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                              {s.vehicleId?.chassisNumber}
                            </p>
                          </div>
                          <p className="shrink-0 text-xs text-slate-500">
                            Paid {formatMoney(s.totalPaid)}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{carName(sale.vehicleId)}</p>
                      <p className="text-xs text-slate-500">{sale.vehicleId?.chassisNumber}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSale(null)}
                      disabled={saving}
                      className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-3 flex justify-between text-sm">
                    <span className="text-slate-500">Customer has paid so far</span>
                    <span className="font-semibold text-slate-900">{formatMoney(sale.totalPaid)}</span>
                  </div>
                </div>
              )}

              {/* Step 2: details */}
              {sale && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      How much are you giving back?
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max={sale.totalPaid}
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, amount: String(sale.totalPaid) }))}
                      className="mt-1 text-xs font-medium text-sky-700 hover:underline"
                    >
                      Give back everything ({formatMoney(sale.totalPaid)})
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        How did you give it?
                      </label>
                      <select
                        value={form.method}
                        onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                      >
                        {METHODS.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Reason (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Why is the money being returned?"
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </div>

                  <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
                    The car stays sold, and the customer will owe this amount again. To cancel the whole sale and put the
                    car back in stock, use <strong>Return Sale</strong> on the Sales page instead.
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeRefund}
                disabled={saving}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRefund()}
                disabled={saving || !sale}
                className="h-10 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Return money"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <CircleDollarSign className="h-5 w-5 text-slate-300" />
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}