"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

type LoanDirection = "BUSINESS_BORROWED" | "PARTNER_ADVANCE";
type CounterpartyType = "PARTNER" | "BANK" | "INDIVIDUAL" | "OTHER";
type PaymentMethod = "CASH" | "BANK" | "ONLINE" | "OTHER";

type Partner = {
  _id: string;
  name: string;
  phone?: string;
};

type Loan = {
  _id: string;
  direction: LoanDirection;
  counterpartyType: CounterpartyType;
  counterpartyName: string;
  partnerId?: string | Partner | null;
  principalAmount: number;
  totalRepaid: number;
  outstandingPrincipal: number;
  loanDate: string;
  dueDate?: string | null;
  notes?: string;
  status: "ACTIVE" | "SETTLED" | "VOIDED";
};

type FinanceTransaction = {
  _id: string;
  type: string;
  amount: number;
  transactionDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  status: "VALID" | "VOIDED";
};

type LoanForm = {
  direction: LoanDirection;
  counterpartyType: CounterpartyType;
  partnerId: string;
  counterpartyName: string;
  principalAmount: string;
  loanDate: string;
  dueDate: string;
  paymentMethod: PaymentMethod;
  reference: string;
  notes: string;
};

type RepaymentForm = {
  amount: string;
  transactionDate: string;
  paymentMethod: PaymentMethod;
  reference: string;
  notes: string;
};

const LIMIT = 10;

const paymentMethods: PaymentMethod[] = [
  "CASH",
  "BANK",
  "ONLINE",
  "OTHER",
];

function localDateInput() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateForInput(value?: string | null) {
  if (!value) return "";

  // API date fields are ISO strings; preserve their original day.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return "";
}

function formatPrice(value: number) {
    return new Intl.NumberFormat("en-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function emptyLoanForm(): LoanForm {
  return {
    direction: "BUSINESS_BORROWED",
    counterpartyType: "INDIVIDUAL",
    partnerId: "",
    counterpartyName: "",
    principalAmount: "",
    loanDate: localDateInput(),
    dueDate: "",
    paymentMethod: "CASH",
    reference: "",
    notes: "",
  };
}

function emptyRepaymentForm(): RepaymentForm {
  return {
    amount: "",
    transactionDate: localDateInput(),
    paymentMethod: "CASH",
    reference: "",
    notes: "",
  };
}

function statusClasses(status: Loan["status"]) {
  switch (status) {
    case "SETTLED":
      return "bg-emerald-50 text-emerald-700";

    case "VOIDED":
      return "bg-red-50 text-red-700";

    default:
      return "bg-amber-50 text-amber-700";
  }
}

function directionLabel(direction: LoanDirection) {
  return direction === "BUSINESS_BORROWED"
    ? "Money Borrowed"
    : "Partner Advance";
}

function transactionLabel(type: string) {
  const labels: Record<string, string> = {
    LOAN_RECEIVED: "Loan Received",
    LOAN_PRINCIPAL_REPAYMENT: "Principal Repaid",
    PARTNER_ADVANCE_GIVEN: "Partner Advance Given",
    PARTNER_ADVANCE_REPAID: "Advance Repaid",
  };

  return labels[type] || type.replaceAll("_", " ");
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [loanForm, setLoanForm] = useState<LoanForm>(
    emptyLoanForm(),
  );

  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [repaymentLoan, setRepaymentLoan] = useState<Loan | null>(null);
  const [repaymentForm, setRepaymentForm] = useState<RepaymentForm>(
    emptyRepaymentForm(),
  );

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoan, setHistoryLoan] = useState<Loan | null>(null);
  const [history, setHistory] = useState<FinanceTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const loadPartners = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
      });

      const response = await fetch(`/api/partners?${params}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load partners.");
      }

      setPartners(result.data || []);
    } catch (err) {
      console.error("Load partners error:", err);
    }
  }, []);

  const loadLoans = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });

      if (search) params.set("search", search);

      if (directionFilter !== "ALL") {
        params.set("direction", directionFilter);
      }

      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/loans?${params}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load loans.");
      }

      const loaded: Loan[] = result.data || [];
      const count = Number(result.totalCount || 0);

      // Recover if the last record on this page was deleted.
      if (loaded.length === 0 && page > 1 && count <= (page - 1) * LIMIT) {
        setPage(Math.max(1, Math.ceil(count / LIMIT)));
        return;
      }

      setLoans(loaded);
      setTotalCount(count);
      setHasMore(Boolean(result.hasMore));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load loans.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, directionFilter, statusFilter]);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  function updateLoanField<K extends keyof LoanForm>(
    field: K,
    value: LoanForm[K],
  ) {
    setLoanForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreateModal() {
    setEditingLoan(null);
    setLoanForm(emptyLoanForm());
    setModalOpen(true);
  }

  function openEditModal(loan: Loan) {
    setEditingLoan(loan);

    setLoanForm({
      ...emptyLoanForm(),
      direction: loan.direction,
      counterpartyType: loan.counterpartyType,
      partnerId:
        typeof loan.partnerId === "string"
          ? loan.partnerId
          : loan.partnerId?._id || "",
      counterpartyName: loan.counterpartyName || "",
      principalAmount: String(loan.principalAmount),
      loanDate: dateForInput(loan.loanDate),
      dueDate: dateForInput(loan.dueDate),
      notes: loan.notes || "",
    });

    setModalOpen(true);
  }

  function closeLoanModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingLoan(null);
    setLoanForm(emptyLoanForm());
  }

  async function handleSaveLoan() {
    const amount = Number(loanForm.principalAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      window.alert("Enter a valid loan amount greater than zero.");
      return;
    }

    if (!loanForm.loanDate) {
      window.alert("Select the loan date.");
      return;
    }

    if (!editingLoan && !loanForm.counterpartyType) {
      window.alert("Select who provided or received the money.");
      return;
    }

    if (
      loanForm.direction === "PARTNER_ADVANCE" &&
      !loanForm.partnerId
    ) {
      window.alert("Select the partner receiving this advance.");
      return;
    }

    if (
      loanForm.counterpartyType === "PARTNER" &&
      !loanForm.partnerId
    ) {
      window.alert("Select the registered partner.");
      return;
    }

    if (
      !editingLoan &&
      loanForm.counterpartyType !== "PARTNER" &&
      !loanForm.counterpartyName.trim()
    ) {
      window.alert("Enter the lender's name.");
      return;
    }

    if (
      loanForm.dueDate &&
      loanForm.dueDate < loanForm.loanDate
    ) {
      window.alert("Due date cannot be before the loan date.");
      return;
    }

    const selectedPartner = partners.find(
      (partner) => partner._id === loanForm.partnerId,
    );

    try {
      setSaving(true);

      const payload: Record<string, unknown> = editingLoan
        ? {
            notes: loanForm.notes,
            dueDate: loanForm.dueDate || null,
            counterpartyName: loanForm.counterpartyName,
            principalAmount: amount,
            loanDate: loanForm.loanDate,
            paymentMethod: loanForm.paymentMethod,
            reference: loanForm.reference,
          }
        : {
            direction: loanForm.direction,
            counterpartyType: loanForm.counterpartyType,
            counterpartyName:
              loanForm.counterpartyType === "PARTNER"
                ? selectedPartner?.name || ""
                : loanForm.counterpartyName.trim(),
            partnerId:
              loanForm.counterpartyType === "PARTNER"
                ? loanForm.partnerId
                : undefined,
            principalAmount: amount,
            loanDate: loanForm.loanDate,
            dueDate: loanForm.dueDate || null,
            paymentMethod: loanForm.paymentMethod,
            reference: loanForm.reference,
            notes: loanForm.notes,
          };

      const response = await fetch(
        editingLoan
          ? `/api/loans/${editingLoan._id}`
          : "/api/loans",
        {
          method: editingLoan ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save loan.");
      }

      setModalOpen(false);
      setEditingLoan(null);
      setLoanForm(emptyLoanForm());

      window.alert(
        editingLoan
          ? "Loan updated successfully."
          : "Loan recorded successfully.",
      );

      await loadLoans();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to save loan.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openRepaymentModal(loan: Loan) {
    setRepaymentLoan(loan);
    setRepaymentForm(emptyRepaymentForm());
    setRepaymentOpen(true);
  }

  async function handleSaveRepayment() {
    if (!repaymentLoan) return;

    const amount = Number(repaymentForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid repayment amount.");
      return;
    }

    if (amount > repaymentLoan.outstandingPrincipal + 0.005) {
      window.alert(
        `Repayment cannot exceed ${formatPrice(
          repaymentLoan.outstandingPrincipal,
        )}.`,
      );
      return;
    }

    if (!repaymentForm.transactionDate) {
      window.alert("Select the repayment date.");
      return;
    }

    try {
      setSaving(true);

      const type =
        repaymentLoan.direction === "BUSINESS_BORROWED"
          ? "LOAN_PRINCIPAL_REPAYMENT"
          : "PARTNER_ADVANCE_REPAID";

      const response = await fetch("/api/finance-transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          loanId: repaymentLoan._id,
          amount,
          transactionDate: repaymentForm.transactionDate,
          paymentMethod: repaymentForm.paymentMethod,
          reference: repaymentForm.reference,
          notes: repaymentForm.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to record repayment.");
      }

      setRepaymentOpen(false);
      setRepaymentLoan(null);
      setRepaymentForm(emptyRepaymentForm());

      window.alert("Repayment recorded successfully.");

      await loadLoans();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to record repayment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(loan: Loan) {
    setHistoryLoan(loan);
    setHistoryOpen(true);
    setHistory([]);
    setHistoryLoading(true);

    try {
      const response = await fetch(`/api/loans/${loan._id}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load loan history.");
      }

      setHistory(result.transactions || []);
      setHistoryLoan(result.data || loan);
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to load loan history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleDeleteLoan(loan: Loan) {
    const confirmed = window.confirm(
      `Delete this ${directionLabel(loan.direction).toLowerCase()} record for ${loan.counterpartyName}?\n\n` +
        `Principal: ${formatPrice(loan.principalAmount)}\n` +
        `Repaid: ${formatPrice(loan.totalRepaid)}\n\n` +
        "The server will audit the deletion and delete the linked transactions too.",
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/loans/${loan._id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete loan.");
      }

      window.alert("Loan deleted successfully.");

      await loadLoans();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to delete loan.",
      );
    }
  }

  const pageOutstanding = loans.reduce(
    (sum, loan) =>
      sum +
      (loan.status === "VOIDED" ? 0 : loan.outstandingPrincipal || 0),
    0,
  );

  const pageActiveLoans = loans.filter(
    (loan) => loan.status === "ACTIVE",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Loans
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage borrowed funds, partner advances, repayments, and outstanding balances.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Loan
        </button>
      </div>

      {/* Summary cards are based on the currently displayed page */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Active Loans on Page
            </p>
            <Clock className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {pageActiveLoans}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Outstanding on Page
            </p>
            <Wallet className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatPrice(pageOutstanding)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Excludes voided loans. Change pages or filters to inspect other loans.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_200px_160px_auto_auto]"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search lender or partner..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <select
            value={directionFilter}
            onChange={(event) => {
              setPage(1);
              setDirectionFilter(event.target.value);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="ALL">All Directions</option>
            <option value="BUSINESS_BORROWED">Money Borrowed</option>
            <option value="PARTNER_ADVANCE">Partner Advances</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SETTLED">Settled</option>
            <option value="VOIDED">Voided</option>
          </select>

          <button
            type="submit"
            className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => void loadLoans()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </form>
      </div>

      {/* Loans table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Loan Records
          </h2>
          <p className="text-xs text-slate-500">
            {totalCount === 0
              ? "0 records"
              : `Showing ${(page - 1) * LIMIT + 1}–${Math.min(
                  page * LIMIT,
                  totalCount,
                )} of ${totalCount}`}
          </p>
        </div>

        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadLoans()}
              className="mt-3 text-sm font-medium text-slate-900 underline"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
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
              Add a loan or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {[
                    "Lender / Partner",
                    "Direction",
                    "Principal",
                    "Repaid",
                    "Outstanding",
                    "Loan Date",
                    "Due Date",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-xs font-semibold text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loans.map((loan) => (
                  <tr
                    key={loan._id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {loan.counterpartyName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {loan.counterpartyType}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        {loan.direction === "BUSINESS_BORROWED" ? (
                          <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-amber-600" />
                        )}
                        {directionLabel(loan.direction)}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatPrice(loan.principalAmount)}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatPrice(loan.totalRepaid)}
                    </td>

                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                      {formatPrice(loan.outstandingPrincipal)}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      {formatDate(loan.loanDate)}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600">
                      {formatDate(loan.dueDate)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(
                          loan.status,
                        )}`}
                      >
                        {loan.status}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        {loan.status !== "VOIDED" &&
                          loan.outstandingPrincipal > 0 && (
                            <button
                              type="button"
                              onClick={() => openRepaymentModal(loan)}
                              title="Record repayment"
                              aria-label="Record repayment"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                            >
                              <Wallet className="h-4 w-4" />
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() => void openHistory(loan)}
                          title="View transaction history"
                          aria-label="View transaction history"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {loan.status !== "VOIDED" && (
                          <button
                            type="button"
                            onClick={() => openEditModal(loan)}
                            title="Edit loan"
                            aria-label="Edit loan"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleDeleteLoan(loan)}
                          title="Delete loan"
                          aria-label="Delete loan"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
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
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || !hasMore}
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit loan modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="loan-modal-title"
            className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2
                  id="loan-modal-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {editingLoan ? "Edit Loan" : "Add Loan"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Record borrowed funds or a repayable partner advance.
                </p>
              </div>

              <button
                type="button"
                onClick={closeLoanModal}
                disabled={saving}
                aria-label="Close modal"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {!editingLoan && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Transaction Direction
                    </label>
                    <select
                      value={loanForm.direction}
                      onChange={(event) => {
                        const direction = event.target.value as LoanDirection;

                        setLoanForm((current) => ({
                          ...current,
                          direction,
                          counterpartyType:
                            direction === "PARTNER_ADVANCE"
                              ? "PARTNER"
                              : "INDIVIDUAL",
                          partnerId: "",
                          counterpartyName: "",
                        }));
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                    >
                      <option value="BUSINESS_BORROWED">
                        Business Borrows Money
                      </option>
                      <option value="PARTNER_ADVANCE">
                        Business Gives Partner an Advance
                      </option>
                    </select>
                  </div>

                  {loanForm.direction === "BUSINESS_BORROWED" && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Loan Type
                      </label>
                      <select
                        value={loanForm.counterpartyType}
                        onChange={(event) => {
                          const counterpartyType =
                            event.target.value as CounterpartyType;

                          setLoanForm((current) => ({
                            ...current,
                            counterpartyType,
                            partnerId: "",
                            counterpartyName: "",
                          }));
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                      >
                        <option value="PARTNER">Registered Partner</option>
                        <option value="BANK">Bank</option>
                        <option value="INDIVIDUAL">Individual</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  )}

                  {loanForm.counterpartyType === "PARTNER" ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Partner *
                      </label>
                      <select
                        value={loanForm.partnerId}
                        onChange={(event) => {
                          const partnerId = event.target.value;
                          const partner = partners.find(
                            (item) => item._id === partnerId,
                          );

                          setLoanForm((current) => ({
                            ...current,
                            partnerId,
                            counterpartyName: partner?.name || "",
                          }));
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                      >
                        <option value="">Select partner</option>
                        {partners.map((partner) => (
                          <option key={partner._id} value={partner._id}>
                            {partner.name}
                            {partner.phone ? ` — ${partner.phone}` : ""}
                          </option>
                        ))}
                      </select>
                      {partners.length === 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          No partners are loaded. Add a partner first.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Lender Name *
                      </label>
                      <input
                        value={loanForm.counterpartyName}
                        onChange={(event) =>
                          updateLoanField(
                            "counterpartyName",
                            event.target.value,
                          )
                        }
                        maxLength={150}
                        placeholder="Enter lender or institution name"
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                      />
                    </div>
                  )}
                </>
              )}

              {editingLoan && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {editingLoan.counterpartyName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {directionLabel(editingLoan.direction)} ·{" "}
                    {formatPrice(editingLoan.principalAmount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Financial terms are changed through the audited loan endpoint.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Principal Amount (JPY) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={loanForm.principalAmount}
                    onChange={(event) =>
                      updateLoanField(
                        "principalAmount",
                        event.target.value,
                      )
                    }
                    disabled={
                      Boolean(editingLoan) &&
                      editingLoan?.status === "SETTLED"
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Payment Method
                  </label>
                  <select
                    value={loanForm.paymentMethod}
                    onChange={(event) =>
                      updateLoanField(
                        "paymentMethod",
                        event.target.value as PaymentMethod,
                      )
                    }
                    disabled={Boolean(editingLoan)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 disabled:bg-slate-100"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  {editingLoan && (
                    <p className="mt-1 text-xs text-slate-400">
                      Method belongs to the opening transaction; edit it separately if needed.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Loan Date *
                  </label>
                  <input
                    type="date"
                    value={loanForm.loanDate}
                    onChange={(event) =>
                      updateLoanField("loanDate", event.target.value)
                    }
                    disabled={Boolean(editingLoan)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={loanForm.dueDate}
                    min={loanForm.loanDate || undefined}
                    onChange={(event) =>
                      updateLoanField("dueDate", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Reference
                </label>
                <input
                  value={loanForm.reference}
                  onChange={(event) =>
                    updateLoanField("reference", event.target.value)
                  }
                  maxLength={150}
                  placeholder="Receipt or transaction reference"
                  disabled={Boolean(editingLoan)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={loanForm.notes}
                  onChange={(event) =>
                    updateLoanField("notes", event.target.value)
                  }
                  maxLength={2000}
                  placeholder="Purpose or other details..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeLoanModal}
                disabled={saving}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveLoan()}
                disabled={saving}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingLoan
                    ? "Update Loan"
                    : "Save Loan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repayment modal */}
      {repaymentOpen && repaymentLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="repayment-modal-title"
            className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="repayment-modal-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Record Repayment
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {repaymentLoan.counterpartyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRepaymentOpen(false)}
                disabled={saving}
                aria-label="Close repayment form"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  Outstanding Principal
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatPrice(repaymentLoan.outstandingPrincipal)}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Repayment Amount (JPY) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  max={repaymentLoan.outstandingPrincipal}
                  step="0.01"
                  value={repaymentForm.amount}
                  onChange={(event) =>
                    setRepaymentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={() =>
                    setRepaymentForm((current) => ({
                      ...current,
                      amount: String(
                        repaymentLoan.outstandingPrincipal,
                      ),
                    }))
                  }
                  className="mt-2 text-xs font-medium text-sky-700 hover:underline"
                >
                  Use full outstanding amount
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Repayment Date *
                  </label>
                  <input
                    type="date"
                    value={repaymentForm.transactionDate}
                    onChange={(event) =>
                      setRepaymentForm((current) => ({
                        ...current,
                        transactionDate: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Payment Method
                  </label>
                  <select
                    value={repaymentForm.paymentMethod}
                    onChange={(event) =>
                      setRepaymentForm((current) => ({
                        ...current,
                        paymentMethod: event.target.value as PaymentMethod,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Reference
                </label>
                <input
                  value={repaymentForm.reference}
                  onChange={(event) =>
                    setRepaymentForm((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                  maxLength={150}
                  placeholder="Optional transaction reference"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={repaymentForm.notes}
                  onChange={(event) =>
                    setRepaymentForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  maxLength={2000}
                  placeholder="Optional repayment notes..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setRepaymentOpen(false)}
                disabled={saving}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveRepayment()}
                disabled={saving}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Repayment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction history modal */}
      {historyOpen && historyLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="loan-history-title"
            className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="loan-history-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Loan History
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {historyLoan.counterpartyName} ·{" "}
                  {directionLabel(historyLoan.direction)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close loan history"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Principal</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatPrice(historyLoan.principalAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Repaid</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatPrice(historyLoan.totalRepaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Outstanding</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatPrice(historyLoan.outstandingPrincipal)}
                </p>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-800">
                  No transactions found
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {["Date", "Transaction", "Amount", "Method", "Reference"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-xs font-semibold text-slate-500"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((transaction) => {
                      const opening =
                        transaction.type === "LOAN_RECEIVED" ||
                        transaction.type === "PARTNER_ADVANCE_GIVEN";

                      return (
                        <tr
                          key={transaction._id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatDate(transaction.transactionDate)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {transactionLabel(transaction.type)}
                            {transaction.status === "VOIDED" && (
                              <span className="ml-1 text-xs text-red-600">
                                Voided
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm font-semibold ${
                              opening
                                ? "text-emerald-700"
                                : "text-slate-900"
                            }`}
                          >
                            {opening ? "+" : "−"}
                            {formatPrice(transaction.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {transaction.paymentMethod}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {transaction.reference || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
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