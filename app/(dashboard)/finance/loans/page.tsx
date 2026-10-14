"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
import { formatDate, formatMoney } from "@/lib/format";

type Direction = "BUSINESS_BORROWED" | "PARTNER_ADVANCE";

type Partner = { _id: string; name: string; phone?: string };

type Loan = {
  _id: string;
  direction: Direction;
  counterpartyType: string;
  counterpartyName: string;
  partnerId?: string | { _id: string } | null;
  principalAmount: number;
  totalRepaid: number;
  outstandingPrincipal: number;
  loanDate: string;
  dueDate?: string | null;
  notes?: string;
  status: "ACTIVE" | "SETTLED" | "VOIDED";
};

type Tx = {
  _id: string;
  type: string;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
  reference?: string;
  status: "VALID" | "VOIDED";
};

type LoanForm = {
  direction: Direction;
  partnerId: string;
  lenderName: string;
  amount: string;
  loanDate: string;
  dueDate: string;
  method: string;
  notes: string;
};

type PayForm = {
  amount: string;
  date: string;
  method: string;
  notes: string;
};

const LIMIT = 10;

const METHODS = [
  ["CASH", "Cash"],
  ["BANK", "Bank transfer"],
  ["ONLINE", "Online / mobile app"],
  ["OTHER", "Other"],
] as const;

const methodLabel = (m: string) =>
  METHODS.find((x) => x[0] === m)?.[1] ?? m;

function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const dayOnly = (v?: string | null) => (v ? v.slice(0, 10) : "");

const emptyLoanForm = (): LoanForm => ({
  direction: "BUSINESS_BORROWED",
  partnerId: "",
  lenderName: "",
  amount: "",
  loanDate: todayStr(),
  dueDate: "",
  method: "CASH",
  notes: "",
});

const emptyPayForm = (): PayForm => ({
  amount: "",
  date: todayStr(),
  method: "CASH",
  notes: "",
});

const isBorrowed = (l: Loan) => l.direction === "BUSINESS_BORROWED";

const kindLabel = (d: Direction) =>
  d === "BUSINESS_BORROWED" ? "We borrowed" : "We lent to partner";

const statusInfo = (s: Loan["status"]) =>
  s === "SETTLED"
    ? { label: "Fully paid", cls: "bg-emerald-50 text-emerald-700" }
    : s === "VOIDED"
      ? { label: "Cancelled", cls: "bg-red-50 text-red-700" }
      : { label: "Not fully paid", cls: "bg-amber-50 text-amber-700" };

function txLabel(type: string) {
  const map: Record<string, string> = {
    LOAN_RECEIVED: "Money we received",
    LOAN_PRINCIPAL_REPAYMENT: "We paid back",
    PARTNER_ADVANCE_GIVEN: "Money we lent",
    PARTNER_ADVANCE_REPAID: "Partner paid back",
  };
  return map[type] ?? type;
}

export default function LoansPage() {
  const confirm = useConfirm();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [totals, setTotals] = useState<{ youOwe: number; partnersOwe: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [form, setForm] = useState<LoanForm>(emptyLoanForm());

  const [payLoan, setPayLoan] = useState<Loan | null>(null);
  const [payForm, setPayForm] = useState<PayForm>(emptyPayForm());

  const [historyLoan, setHistoryLoan] = useState<Loan | null>(null);
  const [history, setHistory] = useState<Tx[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const loadPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/partners?page=1&limit=100", {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success) setPartners(json.data || []);
    } catch {
      /* optional */
    }
  }, []);

  const loadTotals = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/overview", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success) {
        setTotals({
          youOwe: json.data.youOwe,
          partnersOwe: json.data.partnersOweLoans,
        });
      }
    } catch {
      /* cards stay empty */
    }
  }, []);

  const loadLoans = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) params.set("search", search);
      if (kindFilter !== "ALL") params.set("direction", kindFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/loans?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      const rows: Loan[] = json.data || [];
      const count = Number(json.totalCount || 0);

      if (rows.length === 0 && page > 1 && count <= (page - 1) * LIMIT) {
        setPage(Math.max(1, Math.ceil(count / LIMIT)));
        return;
      }

      setLoans(rows);
      setTotalCount(count);
      setHasMore(Boolean(json.hasMore));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load loans");
    } finally {
      setLoading(false);
    }
  }, [page, search, kindFilter, statusFilter]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadLoans(), loadTotals()]);
  }, [loadLoans, loadTotals]);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  useEffect(() => {
    void loadTotals();
    void loadPartners();
  }, [loadTotals, loadPartners]);

  const setF = (patch: Partial<LoanForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  /* ---------------------------- add / edit ---------------------------- */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyLoanForm());
    setModalOpen(true);
  };

  const openEdit = (loan: Loan) => {
    setEditing(loan);
    setForm({
      ...emptyLoanForm(),
      direction: loan.direction,
      lenderName: loan.counterpartyName,
      amount: String(loan.principalAmount),
      loanDate: dayOnly(loan.loanDate),
      dueDate: dayOnly(loan.dueDate),
      notes: loan.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  };

  async function handleSave() {
    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter the amount.");
      return;
    }
    if (!form.loanDate) {
      toast.error("Please choose the date.");
      return;
    }
    if (form.dueDate && form.dueDate < form.loanDate) {
      toast.error("The pay-back date cannot be before the loan date.");
      return;
    }

    if (!editing) {
      if (form.direction === "PARTNER_ADVANCE" && !form.partnerId) {
        toast.error("Please choose the partner.");
        return;
      }
      if (
        form.direction === "BUSINESS_BORROWED" &&
        !form.partnerId &&
        !form.lenderName.trim()
      ) {
        toast.error("Please enter who lent you the money.");
        return;
      }
    }

    try {
      setSaving(true);

      let body: Record<string, unknown>;

      if (editing) {
        body = {
          principalAmount: amount,
          loanDate: form.loanDate,
          dueDate: form.dueDate || null,
          notes: form.notes.trim(),
        };
        // Partner loans take their name from the partner record
        if (editing.counterpartyType !== "PARTNER") {
          body.counterpartyName = form.lenderName.trim();
        }
      } else {
        const partner = partners.find((p) => p._id === form.partnerId);
        const isPartner = Boolean(form.partnerId);

        body = {
          direction: form.direction,
          counterpartyType: isPartner ? "PARTNER" : "INDIVIDUAL",
          counterpartyName: isPartner
            ? partner?.name || ""
            : form.lenderName.trim(),
          partnerId: isPartner ? form.partnerId : undefined,
          principalAmount: amount,
          loanDate: form.loanDate,
          dueDate: form.dueDate || null,
          paymentMethod: form.method,
          notes: form.notes.trim(),
        };
      }

      const res = await fetch(
        editing ? `/api/loans/${editing._id}` : "/api/loans",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success(editing ? "Loan updated." : "Loan saved.");
      setModalOpen(false);
      setEditing(null);
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save loan");
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------------- payments ----------------------------- */

  async function handlePay() {
    if (!payLoan) return;

    const amount = Number(payForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter the amount.");
      return;
    }
    if (amount > payLoan.outstandingPrincipal + 0.005) {
      toast.error(
        `The amount cannot be more than ${formatMoney(payLoan.outstandingPrincipal)}.`,
      );
      return;
    }
    if (!payForm.date) {
      toast.error("Please choose the date.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/finance-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isBorrowed(payLoan)
            ? "LOAN_PRINCIPAL_REPAYMENT"
            : "PARTNER_ADVANCE_REPAID",
          loanId: payLoan._id,
          amount,
          transactionDate: payForm.date,
          paymentMethod: payForm.method,
          notes: payForm.notes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success("Payment saved.");
      setPayLoan(null);
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save payment");
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------------- history ----------------------------- */

  async function openHistory(loan: Loan) {
    setHistoryLoan(loan);
    setHistory([]);
    setHistoryLoading(true);

    try {
      const res = await fetch(`/api/loans/${loan._id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setHistory(json.transactions || []);
      setHistoryLoan(json.data || loan);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  }

  /* ------------------------------ delete ------------------------------ */

  async function handleDelete(loan: Loan) {
    const ok = await confirm({
      title: "Delete this loan?",
      description: `${kindLabel(loan.direction)} — ${loan.counterpartyName}, ${formatMoney(
        loan.principalAmount,
      )}. All payments saved for this loan will be deleted too.`,
      confirmText: "Delete",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/loans/${loan._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success("Loan deleted.");
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete loan");
    }
  }

  const editingPartnerLoan = editing?.counterpartyType === "PARTNER";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Loans
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Money you borrowed, or money you lent to a partner, and how much
            is still to be paid back.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add loan
        </button>
      </div>

      {/* Summary (all loans, not only this page) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">
            You still have to pay back
          </p>
          <p className="mt-2 text-2xl font-semibold text-red-600">
            {totals ? formatMoney(totals.youOwe) : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Money you borrowed and have not returned yet
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">
            Partners still have to pay you
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">
            {totals ? formatMoney(totals.partnersOwe) : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Money you lent to partners and not received back yet
          </p>
        </div>
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(220px,1fr)_190px_170px_auto_auto]"
      >
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <select
          value={kindFilter}
          onChange={(e) => {
            setPage(1);
            setKindFilter(e.target.value);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
        >
          <option value="ALL">All loans</option>
          <option value="BUSINESS_BORROWED">We borrowed</option>
          <option value="PARTNER_ADVANCE">We lent to partner</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
        >
          <option value="ALL">Any status</option>
          <option value="ACTIVE">Not fully paid</option>
          <option value="SETTLED">Fully paid</option>
          <option value="VOIDED">Cancelled</option>
        </select>

        <button
          type="submit"
          className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          Search
        </button>

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">All loans</h2>
          <p className="text-xs text-slate-500">
            {totalCount === 0
              ? "No loans"
              : `Showing ${(page - 1) * LIMIT + 1}–${Math.min(
                  page * LIMIT,
                  totalCount,
                )} of ${totalCount}`}
          </p>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
          </div>
        ) : loans.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
            <Wallet className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No loans found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Press “Add loan” when you borrow money or lend to a partner.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {[
                    "Name",
                    "Type",
                    "Amount",
                    "Paid back",
                    "Still to pay",
                    "Date",
                    "Pay back by",
                    "Status",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-xs font-semibold text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const st = statusInfo(loan.status);
                  return (
                    <tr
                      key={loan._id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {loan.counterpartyName}
                        </p>
                        {loan.counterpartyType === "PARTNER" && (
                          <p className="mt-1 text-xs text-slate-400">
                            Partner
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          {isBorrowed(loan) ? (
                            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-amber-600" />
                          )}
                          {kindLabel(loan.direction)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatMoney(loan.principalAmount)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatMoney(loan.totalRepaid)}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                        {formatMoney(loan.outstandingPrincipal)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(loan.loanDate)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(loan.dueDate)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}
                        >
                          {st.label}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          {loan.status !== "VOIDED" &&
                            loan.outstandingPrincipal > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayLoan(loan);
                                  setPayForm(emptyPayForm());
                                }}
                                title={
                                  isBorrowed(loan)
                                    ? "We paid some back"
                                    : "Partner paid some back"
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                              >
                                <Wallet className="h-4 w-4" />
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() => void openHistory(loan)}
                            title="See payments"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {loan.status !== "VOIDED" && (
                            <button
                              type="button"
                              onClick={() => openEdit(loan)}
                              title="Edit"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDelete(loan)}
                            title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((c) => Math.max(1, c - 1))}
              disabled={loading || page <= 1}
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((c) => c + 1)}
              disabled={loading || !hasMore}
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / edit loan */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editing ? "Edit loan" : "Add loan"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {editing
                    ? `${kindLabel(editing.direction)} — ${editing.counterpartyName}`
                    : "What happened?"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {!editing && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        [
                          "BUSINESS_BORROWED",
                          "We borrowed money",
                          "From a bank, a person or a partner",
                        ],
                        [
                          "PARTNER_ADVANCE",
                          "We lent money to a partner",
                          "The partner will pay it back",
                        ],
                      ] as const
                    ).map(([value, title, hint]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setF({
                            direction: value,
                            partnerId: "",
                            lenderName: "",
                          })
                        }
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          form.direction === value
                            ? "border-sky-500 bg-sky-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      {form.direction === "BUSINESS_BORROWED"
                        ? "Who lent you the money?"
                        : "Which partner?"}
                    </label>
                    <select
                      value={form.partnerId}
                      onChange={(e) => setF({ partnerId: e.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                    >
                      <option value="">
                        {form.direction === "BUSINESS_BORROWED"
                          ? "Someone else (bank, friend, other)"
                          : "Select partner"}
                      </option>
                      {partners.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                          {p.phone ? ` — ${p.phone}` : ""}
                        </option>
                      ))}
                    </select>
                    {partners.length === 0 &&
                      form.direction === "PARTNER_ADVANCE" && (
                        <p className="mt-1 text-xs text-amber-700">
                          Add a partner first on the Partners page.
                        </p>
                      )}
                  </div>
                </>
              )}

              {((!editing &&
                form.direction === "BUSINESS_BORROWED" &&
                !form.partnerId) ||
                (editing && !editingPartnerLoan)) && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Name of lender
                  </label>
                  <input
                    value={form.lenderName}
                    onChange={(e) => setF({ lenderName: e.target.value })}
                    maxLength={150}
                    placeholder="e.g. HBL Bank, Bilal Ahmed"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>
              )}

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
                    onChange={(e) => setF({ amount: e.target.value })}
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.loanDate}
                    onChange={(e) => setF({ loanDate: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Pay back by (optional)
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    min={form.loanDate || undefined}
                    onChange={(e) => setF({ dueDate: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>

                {!editing && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      How was it paid?
                    </label>
                    <select
                      value={form.method}
                      onChange={(e) => setF({ method: e.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                    >
                      {METHODS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Note (optional)
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  maxLength={2000}
                  onChange={(e) => setF({ notes: e.target.value })}
                  placeholder="Why was it needed? Any agreement?"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : editing ? "Save changes" : "Save loan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record a payment */}
      {payLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isBorrowed(payLoan)
                    ? "We paid back some money"
                    : "Partner paid back some money"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {payLoan.counterpartyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !saving && setPayLoan(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Still to pay</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatMoney(payLoan.outstandingPrincipal)}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Amount
                </label>
                <input
                  type="number"
                  min="0.01"
                  max={payLoan.outstandingPrincipal}
                  step="0.01"
                  value={payForm.amount}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPayForm((f) => ({
                      ...f,
                      amount: String(payLoan.outstandingPrincipal),
                    }))
                  }
                  className="mt-1 text-xs font-medium text-sky-700 hover:underline"
                >
                  Pay everything ({formatMoney(payLoan.outstandingPrincipal)})
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date
                  </label>
                  <input
                    type="date"
                    value={payForm.date}
                    onChange={(e) =>
                      setPayForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    How was it paid?
                  </label>
                  <select
                    value={payForm.method}
                    onChange={(e) =>
                      setPayForm((f) => ({ ...f, method: e.target.value }))
                    }
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
                  Note (optional)
                </label>
                <textarea
                  rows={2}
                  value={payForm.notes}
                  maxLength={2000}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setPayLoan(null)}
                disabled={saving}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePay()}
                disabled={saving}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payments list */}
      {historyLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Payments for this loan
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {historyLoan.counterpartyName} ·{" "}
                  {kindLabel(historyLoan.direction)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryLoan(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3">
              {[
                ["Amount", historyLoan.principalAmount],
                ["Paid back", historyLoan.totalRepaid],
                ["Still to pay", historyLoan.outstandingPrincipal],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatMoney(value as number)}
                  </p>
                </div>
              ))}
            </div>

            {historyLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
              </div>
            ) : history.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Nothing recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((t) => {
                  const opening =
                    t.type === "LOAN_RECEIVED" ||
                    t.type === "PARTNER_ADVANCE_GIVEN";
                  return (
                    <div
                      key={t._id}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {txLabel(t.type)}
                          {t.status === "VOIDED" && (
                            <span className="ml-2 text-xs text-red-600">
                              Cancelled
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(t.transactionDate)} ·{" "}
                          {methodLabel(t.paymentMethod)}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-semibold ${
                          opening ? "text-slate-500" : "text-emerald-700"
                        }`}
                      >
                        {formatMoney(t.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setHistoryLoan(null)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}