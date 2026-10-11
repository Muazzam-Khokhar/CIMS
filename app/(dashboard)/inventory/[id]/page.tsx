"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CarFront,
  CircleDollarSign,
  Pencil,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wrench,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
import { ReturnSaleModal } from "@/components/ReturnSaleModal";

type VehicleImage = {
  url: string;
  publicId: string;
};

type Vehicle = {
  _id: string;
  name: string;
  model: string;
  year: number;
  color: string;
  chassisNumber: string;
  engineNumber?: string;
  registrationNumber?: string;
  mileage?: number;
  purchaseDate?: string;
  purchasePrice?: number;
  location?: string;
  condition?: string;
  notes?: string;
  images: VehicleImage[];
  status: "AVAILABLE" | "SOLD" | "DISCARDED";
  createdAt: string;
  updatedAt: string;
};

type SaleSummary = {
  _id: string;
  saleType: "CUSTOMER" | "AUCTION";
  salePrice: number;
  saleDate: string;
  totalPaid: number;
  remaining: number;
  paymentStatus: "PAID" | "PARTIAL";
  profit: number;
};

type Financials = {
  vehicleExpenses: number;
  expenseCount: number;
  investment: number;
  sale: SaleSummary | null;
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function formatPrice(value?: number | null) {
  if (value === undefined || value === null) {
    return "—";
  }

  return `Rs. ${value.toLocaleString("en-PK")}`;
}

function formatDate(value?: string) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: Vehicle["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "SOLD":
      return "Sold";
    case "DISCARDED":
      return "Discarded";
  }
}

function statusClass(status: Vehicle["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10";
    case "SOLD":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-600/10";
    case "DISCARDED":
      return "bg-red-50 text-red-700 ring-1 ring-red-600/10";
  }
}

export default function VehicleViewPage({ params }: Props) {
  const { id } = use(params);
  const confirm = useConfirm();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [financials, setFinancials] = useState<Financials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const todayString = () => new Date().toISOString().split("T")[0];
  const [returnOpen, setReturnOpen] = useState(false);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    expenseDate: todayString(),
    notes: "",
  });

  const loadVehicle = useCallback(
    async (showSpinner = true) => {
      try {
        if (showSpinner) {
          setLoading(true);
          setActiveImage(0);
        }

        setError("");

        const response = await fetch(`/api/vehicles/${id}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load vehicle");
        }

        setVehicle(result.data);
        setFinancials(result.financials ?? null);
      } catch (error) {
        console.error("Failed to load vehicle:", error);

        setVehicle(null);
        setFinancials(null);
        setError(
          error instanceof Error ? error.message : "Failed to load vehicle"
        );
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  const handleDiscard = async () => {
    if (!vehicle) return;

    const confirmed = await confirm({
      title: "Discard this vehicle?",
      description: `"${vehicle.name} ${vehicle.model}" will be marked as discarded and can no longer be sold or edited.`,
      confirmText: "Discard",
    });

    if (!confirmed) return;

    try {
      setDiscarding(true);

      const response = await fetch(`/api/vehicles/${vehicle._id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to discard vehicle");
      }

      toast.success("Vehicle discarded.");

      await loadVehicle(false);
    } catch (error) {
      console.error("Discard vehicle error:", error);

      toast.error(
        error instanceof Error ? error.message : "Failed to discard vehicle"
      );
    } finally {
      setDiscarding(false);
    }
  };
  const openExpenseModal = () => {
    setExpenseForm({
      title: "",
      amount: "",
      expenseDate: todayString(),
      notes: "",
    });
    setExpenseOpen(true);
  };
  
  const handleAddExpense = async () => {
    if (!vehicle) return;
  
    const amount = Number(expenseForm.amount);
  
    if (!expenseForm.title.trim()) {
      toast.error("Please enter an expense title.");
      return;
    }
  
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid expense amount.");
      return;
    }
  
    if (!expenseForm.expenseDate) {
      toast.error("Please select the expense date.");
      return;
    }
  
    try {
      setSavingExpense(true);
  
      const response = await fetch("/api/vehicle-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicle._id,
          title: expenseForm.title.trim(),
          amount,
          expenseDate: expenseForm.expenseDate,
          notes: expenseForm.notes.trim() || undefined,
        }),
      });
  
      const result = await response.json();
  
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to add expense");
      }
  
      toast.success("Vehicle expense added successfully.");
      setExpenseOpen(false);
      await loadVehicle(false); // refreshes expenses, investment and profit
    } catch (error) {
      console.error("Add vehicle expense error:", error);
  
      toast.error(
        error instanceof Error ? error.message : "Failed to add expense"
      );
    } finally {
      setSavingExpense(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
      </div>
    );
  }

  if (error || !vehicle) {
    const notFound = /not found/i.test(error);

    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>

        <h2 className="mt-4 text-lg font-semibold text-red-900">
          {notFound ? "Vehicle not found" : "Couldn't load vehicle"}
        </h2>

        <p className="mt-2 text-sm text-red-700">
          {error || "The vehicle could not be loaded."}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {!notFound && (
            <button
              type="button"
              onClick={() => void loadVehicle()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          )}

          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inventory
          </Link>
        </div>
      </div>
    );
  }

  const images = vehicle.images ?? [];
  const currentImage = images[activeImage] ?? images[0];
  const sale = financials?.sale ?? null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inventory
          </Link>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50">
              <CarFront className="h-5 w-5 text-sky-700" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {vehicle.name} {vehicle.model}
                </h1>

                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                    vehicle.status
                  )}`}
                >
                  {statusLabel(vehicle.status)}
                </span>
              </div>

              <p className="mt-0.5 text-sm text-slate-500">
                {vehicle.year} · {vehicle.color}
                {vehicle.registrationNumber
                  ? ` · ${vehicle.registrationNumber}`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {vehicle.status !== "DISCARDED" && (
            <button
              type="button"
              onClick={openExpenseModal}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </button>
          )}
          {vehicle.status === "SOLD" && financials?.sale && (
            <button
              type="button"
              onClick={() => setReturnOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
            >
              Return Sale
            </button>
          )}
          {vehicle.status !== "DISCARDED" && (
            <Link
              href={`/inventory/${vehicle._id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          )}

          {vehicle.status === "AVAILABLE" && (
            <button
              type="button"
              onClick={() => void handleDiscard()}
              disabled={discarding}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {discarding ? "Discarding..." : "Discard"}
            </button>
          )}
        </div>
      </div>

      {vehicle.status === "DISCARDED" && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <p className="text-sm text-red-700">
            This vehicle has been discarded. It can no longer be edited or
            sold.
          </p>
        </div>
      )}

      {/* Financial summary */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Purchase Price"
            value={formatPrice(vehicle.purchasePrice)}
            description={
              vehicle.purchaseDate
                ? `Bought on ${formatDate(vehicle.purchaseDate)}`
                : "Purchase date not set"
            }
            icon={<CarFront className="h-5 w-5" />}
            iconClass="bg-blue-50 text-blue-600"
          />

          <StatCard
            label="Vehicle Expenses"
            value={formatPrice(financials?.vehicleExpenses ?? 0)}
            description={`${financials?.expenseCount ?? 0} expense record${
              (financials?.expenseCount ?? 0) === 1 ? "" : "s"
            }`}
            icon={<Wrench className="h-5 w-5" />}
            iconClass="bg-orange-50 text-orange-600"
          />

          <StatCard
            label="Total Investment"
            value={formatPrice(financials?.investment ?? vehicle.purchasePrice ?? 0)}
            description="Purchase price + expenses"
            icon={<Wallet className="h-5 w-5" />}
            iconClass="bg-violet-50 text-violet-600"
          />

          {sale ? (
            <StatCard
              label={sale.profit >= 0 ? "Profit" : "Loss"}
              value={formatPrice(Math.abs(sale.profit))}
              description="Sale price − total investment"
              valueClass={
                sale.profit >= 0 ? "text-emerald-600" : "text-red-600"
              }
              icon={
                sale.profit >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )
              }
              iconClass={
                sale.profit >= 0
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              }
            />
          ) : (
            <StatCard
              label="Sale"
              value={vehicle.status === "SOLD" ? "No sale record" : "Not sold"}
              description={
                vehicle.status === "AVAILABLE"
                  ? "Currently in stock"
                  : "Nothing to show"
              }
              icon={<CircleDollarSign className="h-5 w-5" />}
              iconClass="bg-slate-100 text-slate-500"
            />
          )}
        </div>

        {vehicle.purchasePrice === undefined && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Purchase price is not set, so investment and profit are incomplete.
            Add it from Edit.
          </p>
        )}
      </section>

      {/* Images */}
      {images.length > 0 && currentImage && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Vehicle Images
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {images.length} {images.length === 1 ? "image" : "images"}
              </p>
            </div>
          </div>

          <a
            href={currentImage.url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.url}
              alt={`${vehicle.name} image ${activeImage + 1}`}
              className="h-72 w-full object-contain sm:h-96"
            />
          </a>

          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {images.map((image, index) => (
                <button
                  key={image.publicId}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`Show image ${index + 1}`}
                  className={`overflow-hidden rounded-lg border-2 transition ${
                    index === activeImage
                      ? "border-sky-500"
                      : "border-transparent hover:border-slate-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={`${vehicle.name} thumbnail ${index + 1}`}
                    className="h-16 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Sale summary */}
      {sale && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Sale Summary
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Sold on {formatDate(sale.saleDate)}
              </p>
            </div>

            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                sale.paymentStatus === "PAID"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {sale.paymentStatus === "PAID" ? "Paid" : "Partial payment"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryRow
              label="Sale Type"
              value={sale.saleType === "CUSTOMER" ? "Customer" : "Auction"}
            />
            <SummaryRow label="Sale Price" value={formatPrice(sale.salePrice)} />
            <SummaryRow
              label="Received"
              value={formatPrice(sale.totalPaid)}
              valueClass="text-emerald-600"
            />
            <SummaryRow
              label="Remaining"
              value={formatPrice(sale.remaining)}
              valueClass={sale.remaining > 0 ? "text-amber-600" : undefined}
            />
          </div>
        </section>
      )}

      {/* Vehicle details */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Vehicle Details
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Basic information about this vehicle.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Vehicle Name" value={vehicle.name} />
          <Detail label="Model" value={vehicle.model} />
          <Detail label="Year" value={String(vehicle.year)} />
          <Detail label="Color" value={vehicle.color} />
          <Detail label="Chassis Number" value={vehicle.chassisNumber} mono />
          <Detail label="Engine Number" value={vehicle.engineNumber} mono />
          <Detail
            label="Registration Number"
            value={vehicle.registrationNumber}
          />
          <Detail
            label="Mileage"
            value={
              vehicle.mileage != null
                ? `${vehicle.mileage.toLocaleString("en-PK")} km`
                : undefined
            }
          />
          <Detail label="Location" value={vehicle.location} />
          <Detail label="Condition" value={vehicle.condition} />
          <Detail
            label="Purchase Date"
            value={vehicle.purchaseDate ? formatDate(vehicle.purchaseDate) : undefined}
          />
          <Detail label="Added" value={formatDate(vehicle.createdAt)} />
          <Detail label="Last Updated" value={formatDate(vehicle.updatedAt)} />
        </div>
      </section>

      {/* Notes */}
      {vehicle.notes && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Notes</h2>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {vehicle.notes}
          </p>
        </section>
      )}
      {expenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Add Vehicle Expense
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {vehicle.name} {vehicle.model} · {vehicle.chassisNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExpenseOpen(false)}
                disabled={savingExpense}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Expense Title
                </label>
                <input
                  type="text"
                  value={expenseForm.title}
                  onChange={(e) =>
                    setExpenseForm((c) => ({ ...c, title: e.target.value }))
                  }
                  placeholder="e.g. Oil change, repair, detailing"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm((c) => ({ ...c, amount: e.target.value }))
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) =>
                      setExpenseForm((c) => ({ ...c, expenseDate: e.target.value }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                  <span className="ml-1 font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={expenseForm.notes}
                  onChange={(e) =>
                    setExpenseForm((c) => ({ ...c, notes: e.target.value }))
                  }
                  placeholder="Additional details..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setExpenseOpen(false)}
                disabled={savingExpense}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleAddExpense()}
                disabled={savingExpense}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingExpense ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
      {financials?.sale && (
        <ReturnSaleModal
          open={returnOpen}
          saleId={financials.sale._id}
          vehicleLabel={`${vehicle.name} ${vehicle.model} · ${vehicle.chassisNumber}`}
          totalPaid={financials.sale.totalPaid}
          onClose={() => setReturnOpen(false)}
          onSuccess={() => loadVehicle(false)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  iconClass,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>

          <p className={`mt-2 truncate text-xl font-bold ${valueClass}`}>
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${iconClass}`}>{icon}</div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>

      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>

      <p
        className={`mt-1.5 text-sm font-medium break-words text-slate-800 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}