"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash, X } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
import { ReturnSaleModal } from "@/components/ReturnSaleModal";
import { formatDate, formatMoney } from "@/lib/format";

type Method = "CASH" | "BANK" | "ONLINE" | "OTHER";

type Sale = {
  _id: string;
  vehicleId: {
    name: string;
    model?: string;
    chassisNumber?: string;
  } | null;
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
};

type Payment = {
  _id: string;
  type?: "RECEIVED" | "REFUND";
  amount: number;
  paymentDate: string;
  paymentMethod: Method;
  notes?: string;
};

const METHODS: [Method, string][] = [
  ["CASH", "Cash"],
  ["BANK", "Bank transfer"],
  ["ONLINE", "Online / mobile app"],
  ["OTHER", "Other"],
];

const methodLabel = (m: string) => METHODS.find((x) => x[0] === m)?.[1] ?? m;

function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const emptyForm = () => ({
  amount: "",
  date: todayStr(),
  method: "CASH" as Method,
  notes: "",
});

const badge = (s: Sale["paymentStatus"]) =>
  s === "PAID"
    ? { label: "Paid", cls: "bg-emerald-50 text-emerald-700" }
    : s === "RETURNED"
      ? { label: "Returned", cls: "bg-red-50 text-red-700" }
      : { label: "Partial", cls: "bg-amber-50 text-amber-700" };

type Props = {
  /** Pass a sale id to open the modal, null to keep it closed */
  saleId: string | null;
  onClose: () => void;
  /** Called after any payment or return changes the sale */
  onChanged?: () => void | Promise<void>;
  /** Open with the "Add payment" form already showing */
  openAddForm?: boolean;
};

export function SaleDetailsModal({
  saleId,
  onClose,
  onChanged,
  openAddForm = false,
}: Props) {
  const confirm = useConfirm();

  const [sale, setSale] = useState<Sale | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  // Keep the latest callbacks without re-running the load effect
  const onCloseRef = useRef(onClose);
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onCloseRef.current = onClose;
    onChangedRef.current = onChanged;
  });

  const load = useCallback(async (id: string, initial = false) => {
    try {
      const [saleRes, payRes] = await Promise.all([
        fetch(`/api/sales?saleId=${id}&status=ALL&limit=1`, {
          cache: "no-store",
        }),
        fetch(`/api/payments?saleId=${id}&limit=100`, { cache: "no-store" }),
      ]);
      const [saleJson, payJson] = await Promise.all([
        saleRes.json(),
        payRes.json(),
      ]);

      if (!saleRes.ok || !saleJson.success)
        throw new Error(saleJson.message || "Could not load the sale");
      if (!payRes.ok || !payJson.success)
        throw new Error(payJson.message || "Could not load the payments");

      const found: Sale | undefined = saleJson.data?.[0];
      if (!found) throw new Error("Sale not found");

      setSale(found);
      setPayments(payJson.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the sale");
      if (initial) onCloseRef.current();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!saleId) {
      setSale(null);
      setPayments([]);
      return;
    }

    setSale(null);
    setPayments([]);
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(openAddForm);
    setLoading(true);
    void load(saleId, true);
  }, [saleId, openAddForm, load]);

  if (!saleId) return null;

  const isReturned = sale?.status === "RETURNED";
  const editingAmount = payments.find((p) => p._id === editingId)?.amount ?? 0;
  const maxAllowed = (sale?.remaining ?? 0) + editingAmount;

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setForm(emptyForm());
  };

  const refresh = async () => {
    await load(saleId);
    await onChangedRef.current?.();
  };

  const startEdit = (p: Payment) => {
    setEditingId(p._id);
    setForm({
      amount: String(p.amount),
      date: new Date(p.paymentDate).toISOString().split("T")[0],
      method: p.paymentMethod,
      notes: p.notes || "",
    });
    setShowForm(true);
  };

  const close = () => {
    if (saving) return;
    onClose();
  };

  async function save() {
    if (!sale) return;

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter the amount.");
      return;
    }
    if (amount > maxAllowed + 0.005) {
      toast.error(`The amount cannot be more than ${formatMoney(maxAllowed)}.`);
      return;
    }
    if (!form.date) {
      toast.error("Please choose the date.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        editingId ? `/api/payments/${editingId}` : "/api/payments",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(editingId ? {} : { saleId: sale._id }),
            amount,
            paymentDate: form.date,
            paymentMethod: form.method,
            notes: form.notes.trim() || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success(editingId ? "Payment updated." : "Payment added.");
      resetForm();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save payment");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Payment) {
    const ok = await confirm({
      title: "Delete this payment?",
      description: `${formatMoney(p.amount)} will be removed and the remaining amount will go up.`,
      confirmText: "Delete",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/payments/${p._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success("Payment deleted.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete payment");
    }
  }

  const v = sale?.vehicleId;
  const carName = v ? `${v.name} ${v.model ?? ""}`.trim() : "";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900">Sale details</h2>
              <p className="mt-1 truncate text-sm text-slate-500">
                {carName || "Loading..."}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {loading || !sale ? (
            <div className="flex h-60 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
            </div>
          ) : (
            <>
              <div className="overflow-y-auto p-5 sm:p-6">
                {isReturned && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Returned on{" "}
                    {sale.returnDate ? formatDate(sale.returnDate) : "—"}.
                    Refunded {formatMoney(sale.refundAmount ?? 0)}.
                    {sale.returnReason ? ` Reason: ${sale.returnReason}` : ""}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Row
                    label="Sale type"
                    value={sale.saleType === "CUSTOMER" ? "Customer" : "Auction"}
                  />
                  <Row label="Sale price" value={formatMoney(sale.salePrice)} />
                  <Row label="Total paid" value={formatMoney(sale.totalPaid)} />
                  <Row label="Remaining" value={formatMoney(sale.remaining)} />
                  <Row label="Sale date" value={formatDate(sale.saleDate)} />
                  <Row label="Chassis number" value={v?.chassisNumber || "—"} />
                </div>

                {/* Payments */}
                <div className="mt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Payment history
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {payments.length} entr{payments.length === 1 ? "y" : "ies"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isReturned && sale.remaining > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            showForm ? resetForm() : setShowForm(true)
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          <Plus className="h-4 w-4" />
                          {showForm ? "Close form" : "Add payment"}
                        </button>
                      )}
                      {!isReturned && sale.totalPaid > 0 && (
                        <Link
                          href={`/payments?returnSale=${sale._id}`}
                          className="inline-flex items-center rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Return payment
                        </Link>
                      )}
                    </div>
                  </div>

                  {showForm && !isReturned && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {editingId ? "Edit payment" : "Add payment"}
                      </p>
                      <p className="mt-1 mb-4 text-xs text-slate-500">
                        {editingId ? "Most you can enter" : "Still to pay"}:{" "}
                        <span className="font-semibold text-amber-600">
                          {formatMoney(maxAllowed)}
                        </span>
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Amount">
                          <input
                            type="number"
                            min="0.01"
                            max={maxAllowed}
                            step="0.01"
                            value={form.amount}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, amount: e.target.value }))
                            }
                            placeholder="0"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                amount: String(maxAllowed),
                              }))
                            }
                            className="mt-1 text-xs font-medium text-sky-700 hover:underline"
                          >
                            Pay everything ({formatMoney(maxAllowed)})
                          </button>
                        </Field>

                        <Field label="Date">
                          <input
                            type="date"
                            value={form.date}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, date: e.target.value }))
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                          />
                        </Field>

                        <Field label="How was it paid?">
                          <select
                            value={form.method}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                method: e.target.value as Method,
                              }))
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                          >
                            {METHODS.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Note (optional)">
                          <input
                            value={form.notes}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, notes: e.target.value }))
                            }
                            placeholder="Payment details..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                          />
                        </Field>
                      </div>

                      <div className="mt-4 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={resetForm}
                          disabled={saving}
                          className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void save()}
                          disabled={saving}
                          className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {saving
                            ? "Saving..."
                            : editingId
                              ? "Update payment"
                              : "Save payment"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    {payments.length === 0 ? (
                      <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                        No payments recorded for this sale.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {payments.map((p) => {
                          const refund = p.type === "REFUND";
                          return (
                            <div
                              key={p._id}
                              className="flex items-center justify-between gap-3 px-4 py-4"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p
                                    className={`text-sm font-semibold ${
                                      refund ? "text-red-600" : "text-slate-900"
                                    }`}
                                  >
                                    {refund ? "−" : ""}
                                    {formatMoney(p.amount)}
                                  </p>
                                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                    {refund
                                      ? "Returned to customer"
                                      : methodLabel(p.paymentMethod)}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatDate(p.paymentDate)}
                                </p>
                                {p.notes && (
                                  <p className="mt-1 text-xs text-slate-400">
                                    {p.notes}
                                  </p>
                                )}
                              </div>

                              {!isReturned && (
                                <div className="flex shrink-0 gap-1">
                                  {!refund && (
                                    <button
                                      type="button"
                                      onClick={() => startEdit(p)}
                                      title="Edit payment"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void remove(p)}
                                    title="Delete payment"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs text-slate-500">Payment status</p>
                  <span
                    className={`mt-1 inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      badge(sale.paymentStatus).cls
                    }`}
                  >
                    {badge(sale.paymentStatus).label}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {!isReturned && (
                    <button
                      type="button"
                      onClick={() => setReturnOpen(true)}
                      className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Return sale
                    </button>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Remaining</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatMoney(sale.remaining)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {sale && (
        <ReturnSaleModal
          open={returnOpen}
          saleId={sale._id}
          vehicleLabel={carName}
          totalPaid={sale.totalPaid}
          onClose={() => setReturnOpen(false)}
          onSuccess={async () => {
            await onChangedRef.current?.();
            onCloseRef.current();
          }}
        />
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="truncate text-sm font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}