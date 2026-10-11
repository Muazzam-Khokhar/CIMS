"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";

type GeneralExpense = {
  _id: string;
  title: string;
  amount: number;
  expenseDate: string;
  notes?: string;
  createdAt: string;
};

type FormData = {
  title: string;
  amount: string;
  expenseDate: string;
  notes: string;
};

const emptyForm: FormData = {
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

export default function GeneralExpensesPage() {
  const [expenses, setExpenses] = useState<GeneralExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<GeneralExpense | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
  
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
  
      if (search.trim()) {
        params.set("search", search.trim());
      }
  
      const response = await fetch(
        `/api/general-expenses?${params.toString()}`,
      );
  
      const result = await response.json();
  
      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to load general expenses",
        );
      }
  
      const loadedExpenses: GeneralExpense[] = result.data || [];
      const count = Number(result.totalCount || 0);
  
      // Handle deleting the last record on the current page.
      if (
        loadedExpenses.length === 0 &&
        page > 1 &&
        count <= (page - 1) * limit
      ) {
        setPage(Math.max(1, Math.ceil(count / limit)));
        return;
      }
  
      setExpenses(loadedExpenses);
      setTotalCount(count);
      setTotalAmount(Number(result.totalAmount || 0));
      setHasMore(Boolean(result.hasMore));
    } catch (error) {
      console.error("Load general expenses error:", error);
  
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load general expenses",
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);
  
  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const openCreateModal = () => {
    setEditingExpense(null);

    setForm({
      ...emptyForm,
      expenseDate: new Date().toISOString().split("T")[0],
    });

    setModalOpen(true);
  };

  const openEditModal = (expense: GeneralExpense) => {
    setEditingExpense(expense);

    setForm({
      title: expense.title,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate
        ? new Date(expense.expenseDate)
            .toISOString()
            .split("T")[0]
        : "",
      notes: expense.notes || "",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingExpense(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
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
        ? `/api/general-expenses/${editingExpense._id}`
        : "/api/general-expenses";

      const response = await fetch(url, {
        method: editingExpense ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
            `Failed to ${
              editingExpense ? "update" : "create"
            } expense`,
        );
      }

      toast.success(
        editingExpense
          ? "General expense updated successfully."
          : "General expense added successfully.",
      );

      closeModal();
      await loadExpenses();
    } catch (error) {
      console.error("Save general expense error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save general expense",
      );
    } finally {
      setSaving(false);
    }
  };
  const confirm = useConfirm();
  const handleDelete = async (expense: GeneralExpense) => {
    const confirmed = await confirm({
      title: "Delete this expense?",
      description: `Delete "${expense.title}" expense of ${formatPrice(
        expense.amount,
      )}?`,
      confirmText: "Delete",
    });

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/general-expenses/${expense._id}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to delete expense",
        );
      }

      await loadExpenses();
    } catch (error) {
      console.error("Delete general expense error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete general expense",
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            General Expenses
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Track business expenses not directly associated with a vehicle.
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
            Across all general expense records
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
            {search.trim() ? "Matching records" : "General expense records"}
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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search expense or notes..."
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
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
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
              General Expense Records
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              {totalCount === 0
                ? "0 records"
                : `Showing ${(page - 1) * limit + 1}-${Math.min(
                    page * limit,
                    totalCount,
                  )} of ${totalCount} records`}
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
              <Receipt className="h-6 w-6 text-sky-700" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No general expenses found
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {search
                ? "Try changing your search."
                : "Add your first general expense to start tracking business costs."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
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
                      <p className="text-sm font-semibold text-slate-900">
                        {expense.title}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {formatPrice(expense.amount)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(expense.expenseDate)}
                    </td>

                    <td className="max-w-[300px] px-5 py-4 text-sm text-slate-500">
                      <span className="line-clamp-2">
                        {expense.notes || "—"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(expense)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          title="Edit expense"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(expense)
                          }
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
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || !hasMore}
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingExpense
                    ? "Edit General Expense"
                    : "Add General Expense"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Record a general business operating cost.
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
                  placeholder="e.g. Office rent, electricity, salary"
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