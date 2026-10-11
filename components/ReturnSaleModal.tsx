"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  saleId: string;
  vehicleLabel: string;
  totalPaid: number;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

export function ReturnSaleModal({
  open,
  saleId,
  vehicleLabel,
  totalPaid,
  onClose,
  onSuccess,
}: Props) {
  const [returnDate, setReturnDate] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReturnDate(new Date().toISOString().split("T")[0]);
      setRefundAmount(String(totalPaid));
      setReason("");
    }
  }, [open, totalPaid]);

  if (!open) return null;

  const handleSubmit = async () => {
    const refund = Number(refundAmount);

    if (!returnDate) {
      toast.error("Please select the return date.");
      return;
    }

    if (Number.isNaN(refund) || refund < 0) {
      toast.error("Please enter a valid refund amount.");
      return;
    }

    if (refund > totalPaid) {
      toast.error("Refund cannot be more than the amount received.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/sales/${saleId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnDate,
          refundAmount: refund,
          reason: reason.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to return sale");
      }

      toast.success("Sale returned. Vehicle is available again.");
      onClose();
      await onSuccess();
    } catch (error) {
      console.error("Return sale error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to return sale");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Return Sale</h2>
            <p className="mt-0.5 text-xs text-slate-500">{vehicleLabel}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Amount received</span>
              <span className="font-semibold text-slate-900">
                Rs. {totalPaid.toLocaleString("en-PK")}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Return Date
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Refund Amount
            </label>
            <input
              type="number"
              min="0"
              max={totalPaid}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Money given back to the buyer. Lower it if you keep part as a cancellation fee.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Reason
              <span className="ml-1 font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why was the car returned?"
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
            The vehicle goes back to Available. The old sale and its payments stay as history.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="h-10 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "Returning..." : "Confirm Return"}
          </button>
        </div>
      </div>
    </div>
  );
}