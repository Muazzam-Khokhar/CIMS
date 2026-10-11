"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CarFront,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";

type Vehicle = {
  _id: string;
  name: string;
  model: string;
  year: number;
  chassisNumber: string;
  registrationNumber?: string;
};

type VehicleExpense = {
  _id: string;
  vehicleId: Vehicle;
  title: string;
  amount: number;
  expenseDate: string;
  notes?: string;
  createdAt: string;
};

type FormData = {
  vehicleId: string;
  title: string;
  amount: string;
  expenseDate: string;
  notes: string;
};

const emptyForm: FormData = {
  vehicleId: "",
  title: "",
  amount: "",
  expenseDate: new Date().toISOString().split("T")[0],
  notes: "",
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function VehicleExpensesPage() {
  // Expenses list (server-side pagination + search)
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  // Vehicle dropdown (server-side search, loaded only while open)
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<VehicleExpense | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Debounce search and go back to page 1 when it changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });

      const response = await fetch(
        `/api/vehicle-expenses?${params.toString()}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to load vehicle expenses"
        );
      }

      setExpenses(result.data ?? []);
      setTotalCount(result.totalCount ?? 0);
      setTotalAmount(result.totalAmount ?? 0);
    } catch (error) {
      console.error("Load vehicle expenses error:", error);
      setExpenses([]);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load vehicle expenses"
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  // Vehicle dropdown search (server-side, only while dropdown is open)
  useEffect(() => {
    if (!vehicleDropdownOpen) return;

    const timer = setTimeout(async () => {
      try {
        setVehiclesLoading(true);

        const params = new URLSearchParams({
          page: "1",
          limit: "20",
          search: vehicleSearch.trim(),
        });

        const response = await fetch(`/api/vehicles?${params.toString()}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load vehicles");
        }

        setVehicles(result.data ?? []);
      } catch (error) {
        console.error("Load vehicles error:", error);
        setVehicles([]);
      } finally {
        setVehiclesLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [vehicleDropdownOpen, vehicleSearch]);

  const openCreateModal = () => {
    setEditingExpense(null);
    setSelectedVehicle(null);

    setForm({
      ...emptyForm,
      expenseDate: new Date().toISOString().split("T")[0],
    });

    setModalOpen(true);
  };

  const openEditModal = (expense: VehicleExpense) => {
    setEditingExpense(expense);
    setSelectedVehicle(expense.vehicleId ?? null);

    setForm({
      vehicleId: expense.vehicleId?._id || "",
      title: expense.title,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate
        ? new Date(expense.expenseDate).toISOString().split("T")[0]
        : "",
      notes: expense.notes || "",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingExpense(null);
    setSelectedVehicle(null);
    setVehicleDropdownOpen(false);
    setVehicleSearch("");
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.vehicleId) {
      toast.error("Please select a vehicle.");
      return;
    }

    if (!form.title.trim()) {
      toast.error("Please enter an expense title.");
      return;
    }

    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      toast.error("Please enter a valid expense amount.");
      return;
    }

    if (!form.expenseDate) {
      toast.error("Please select the expense date.");
      return;
    }

    try {
      setSaving(true);

      const url = editingExpense
        ? `/api/vehicle-expenses/${editingExpense._id}`
        : "/api/vehicle-expenses";

      const response = await fetch(url, {
        method: editingExpense ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleId: form.vehicleId,
          title: form.title.trim(),
          amount,
          expenseDate: form.expenseDate,
          notes: form.notes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            `Failed to ${editingExpense ? "update" : "create"} expense`
        );
      }

      toast.success(
        editingExpense
          ? "Vehicle expense updated successfully."
          : "Vehicle expense added successfully."
      );

      closeModal();
      await loadExpenses();
    } catch (error) {
      console.error("Save vehicle expense error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save vehicle expense"
      );
    } finally {
      setSaving(false);
    }
  };
  const confirm = useConfirm();
  const handleDelete = async (expense: VehicleExpense) => {
    const confirmed = await confirm({
      title: "Delete this expense?",
      description: `Delete "${expense.title}" expense of ${formatPrice(expense.amount)}?`,
      confirmText: "Delete",
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/vehicle-expenses/${expense._id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete expense");
      }

      // If the last row of a page was deleted, go back one page
      if (expenses.length === 1 && page > 1) {
        setPage((current) => current - 1); // effect reloads
      } else {
        await loadExpenses();
      }
    } catch (error) {
      console.error("Delete vehicle expense error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete vehicle expense"
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Vehicle Expenses
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Track expenses spent on individual vehicles.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-medium text-slate-500">
            Total Expenses
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatPrice(totalAmount)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Across all matching records
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-medium text-slate-500">
            Expense Entries
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totalCount}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Vehicle expense records
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle, chassis, registration or expense..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <button
            type="button"
            onClick={() => void loadExpenses()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Vehicle Expense Records
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              {totalCount} record{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50">
              <CarFront className="h-6 w-6 text-sky-700" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No vehicle expenses found
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {debouncedSearch
                ? "Try changing your search."
                : "Add your first vehicle expense to start tracking vehicle investment."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Vehicle
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Expense
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Amount
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Date
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Notes
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {expenses.map((expense) => (
                  <tr
                    key={expense._id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {expense.vehicleId?.name}{" "}
                          {expense.vehicleId?.model}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {expense.vehicleId?.year} ·{" "}
                          {expense.vehicleId?.chassisNumber}
                        </p>

                        {expense.vehicleId?.registrationNumber && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            Reg: {expense.vehicleId.registrationNumber}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-900">
                        {expense.title}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {formatPrice(expense.amount)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(expense.expenseDate)}
                    </td>

                    <td className="max-w-[260px] px-5 py-4 text-sm text-slate-500">
                      <span className="line-clamp-2">
                        {expense.notes || "—"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(expense)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          title="Edit expense"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(expense)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {totalCount === 0
              ? "No records"
              : `Showing ${(page - 1) * limit + 1}–${Math.min(
                  page * limit,
                  totalCount
                )} of ${totalCount} records`}
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
              Page {page} of {totalPages}
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

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingExpense
                    ? "Edit Vehicle Expense"
                    : "Add Vehicle Expense"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Record a cost associated with a vehicle.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Vehicle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Vehicle
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingExpense) return;

                      setVehicleDropdownOpen((current) => !current);
                    }}
                    disabled={!!editingExpense}
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left transition hover:border-slate-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CarFront className="h-4 w-4 shrink-0 text-slate-400" />

                      {selectedVehicle ? (
                        <span className="truncate text-sm text-slate-700">
                          <span className="font-medium">
                            {selectedVehicle.name} {selectedVehicle.model}
                          </span>

                          <span className="text-slate-400">
                            {" "}
                            · {selectedVehicle.chassisNumber}
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">
                          Search vehicle...
                        </span>
                      )}
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        vehicleDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {vehicleDropdownOpen && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {/* Search */}
                      <div className="border-b border-slate-100 p-2">
                        <div className="relative">
                          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <input
                            type="text"
                            autoFocus
                            value={vehicleSearch}
                            onChange={(e) => setVehicleSearch(e.target.value)}
                            placeholder="Search name, chassis or registration..."
                            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-8 text-sm outline-none focus:border-sky-400 focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* Results */}
                      <div className="max-h-52 overflow-y-auto p-1">
                        {vehiclesLoading ? (
                          <p className="px-3 py-5 text-center text-xs text-slate-400">
                            Searching...
                          </p>
                        ) : vehicles.length === 0 ? (
                          <p className="px-3 py-5 text-center text-xs text-slate-400">
                            No vehicles found
                          </p>
                        ) : (
                          vehicles.map((vehicle) => {
                            const selected = vehicle._id === form.vehicleId;

                            return (
                              <button
                                key={vehicle._id}
                                type="button"
                                onClick={() => {
                                  setSelectedVehicle(vehicle);

                                  setForm((current) => ({
                                    ...current,
                                    vehicleId: vehicle._id,
                                  }));

                                  setVehicleDropdownOpen(false);
                                  setVehicleSearch("");
                                }}
                                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                                  selected ? "bg-sky-50" : "hover:bg-slate-50"
                                }`}
                              >
                                <CarFront
                                  className={`h-4 w-4 shrink-0 ${
                                    selected
                                      ? "text-sky-600"
                                      : "text-slate-400"
                                  }`}
                                />

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-800">
                                    {vehicle.name} {vehicle.model}
                                  </p>

                                  <p className="truncate text-xs text-slate-400">
                                    {vehicle.year} · {vehicle.chassisNumber}
                                    {vehicle.registrationNumber
                                      ? ` · ${vehicle.registrationNumber}`
                                      : ""}
                                  </p>
                                </div>

                                {selected && (
                                  <Check className="h-4 w-4 shrink-0 text-sky-600" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Expense Title
                </label>

                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      title: e.target.value,
                    }))
                  }
                  placeholder="e.g. Oil change, repair, detailing"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              {/* Amount + Date */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Amount
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        amount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Expense Date
                  </label>

                  <input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        expenseDate: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                  <span className="ml-1 font-normal text-slate-400">
                    (optional)
                  </span>
                </label>

                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      notes: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Additional details..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingExpense
                    ? "Update Expense"
                    : "Save Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}