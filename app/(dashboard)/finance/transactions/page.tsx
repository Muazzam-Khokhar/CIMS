
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

type Partner = {
  _id: string;
  name: string;
  phone?: string;
};

type Loan = {
  _id: string;
  direction: "BUSINESS_BORROWED" | "PARTNER_ADVANCE";
  counterpartyName: string;
  principalAmount: number;
  totalRepaid: number;
  outstandingPrincipal: number;
  status: "ACTIVE" | "SETTLED" | "VOIDED";
};

type FinanceType =
  | "PARTNER_CONTRIBUTION"
  | "PARTNER_CAPITAL_RETURN"
  | "PARTNER_DRAWING"
  | "LOAN_RECEIVED"
  | "LOAN_PRINCIPAL_REPAYMENT"
  | "PARTNER_ADVANCE_GIVEN"
  | "PARTNER_ADVANCE_REPAID"
  | "BUSINESS_ADVANCE_GIVEN"
  | "BUSINESS_ADVANCE_SETTLED";

type PaymentMethod = "CASH" | "BANK" | "ONLINE" | "OTHER";
type SettlementType = "EXPENSE" | "CASH_RETURN";

type FinanceTransaction = {
  _id: string;
  type: FinanceType;
  partnerId?: string | Partner | null;
  loanId?: string | Loan | null;
  relatedTransactionId?: string | null;
  settlementType?: SettlementType | null;
  amount: number;
  transactionDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  status: "VALID" | "VOIDED";
};

type AdvanceOption = FinanceTransaction & {
  outstandingAmount: number;
};

type TransactionForm = {
  type: FinanceType;
  partnerId: string;
  loanId: string;
  relatedTransactionId: string;
  settlementType: SettlementType;
  amount: string;
  transactionDate: string;
  paymentMethod: PaymentMethod;
  reference: string;
  notes: string;
};

const LIMIT = 10;

const METHODS: PaymentMethod[] = [
  "CASH",
  "BANK",
  "ONLINE",
  "OTHER",
];

const CREATABLE_TYPES: FinanceType[] = [
  "PARTNER_CONTRIBUTION",
  "PARTNER_CAPITAL_RETURN",
  "PARTNER_DRAWING",
  "LOAN_PRINCIPAL_REPAYMENT",
  "PARTNER_ADVANCE_REPAID",
  "BUSINESS_ADVANCE_GIVEN",
  "BUSINESS_ADVANCE_SETTLED",
];

const TYPE_LABELS: Record<FinanceType, string> = {
  PARTNER_CONTRIBUTION: "Partner Add Assests",
  PARTNER_CAPITAL_RETURN: "Partner Assests Return",
  PARTNER_DRAWING: "Partner Personal Drawing",
  LOAN_RECEIVED: "Loan Received",
  LOAN_PRINCIPAL_REPAYMENT: "Loan Principal Repaid",
  PARTNER_ADVANCE_GIVEN: "Partner Advance Given",
  PARTNER_ADVANCE_REPAID: "Partner Advance Repaid",
  BUSINESS_ADVANCE_GIVEN: "Business Advance Given",
  BUSINESS_ADVANCE_SETTLED: "Business Advance Settlement",
};

function today() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-JP", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function idOf(value: unknown): string {
  if (typeof value === "string") return value;

  if (value && typeof value === "object" && "_id" in value) {
    return String(value._id);
  }

  return "";
}

function emptyForm(): TransactionForm {
  return {
    type: "PARTNER_CONTRIBUTION",
    partnerId: "",
    loanId: "",
    relatedTransactionId: "",
    settlementType: "EXPENSE",
    amount: "",
    transactionDate: today(),
    paymentMethod: "CASH",
    reference: "",
    notes: "",
  };
}

function isOpeningTransaction(type: FinanceType) {
  return (
    type === "LOAN_RECEIVED" ||
    type === "PARTNER_ADVANCE_GIVEN"
  );
}

function requiresPartner(type: FinanceType) {
  return [
    "PARTNER_CONTRIBUTION",
    "PARTNER_CAPITAL_RETURN",
    "PARTNER_DRAWING",
    "BUSINESS_ADVANCE_GIVEN",
  ].includes(type);
}

function requiresLoan(type: FinanceType) {
  return (
    type === "LOAN_PRINCIPAL_REPAYMENT" ||
    type === "PARTNER_ADVANCE_REPAID"
  );
}

function signForType(type: FinanceType) {
  if (
    type === "PARTNER_CONTRIBUTION" ||
    type === "LOAN_RECEIVED"
  ) {
    return "in";
  }

  return "out";
}

function partnerName(value?: string | Partner | null) {
  if (value && typeof value === "object") return value.name;
  return "—";
}

function loanName(value?: string | Loan | null) {
  if (value && typeof value === "object") {
    return value.counterpartyName;
  }

  return "—";
}

async function readResult<T>(response: Response): Promise<T> {
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Request failed.");
  }

  return result as T;
}

/**
 * Read paginated choices without silently dropping records after page 1.
 * The hard limit prevents accidental infinite requests.
 */
async function fetchAllPages<T>(
  path: string,
  extraParams: Record<string, string> = {},
): Promise<T[]> {
  const output: T[] = [];

  for (let page = 1; page <= 100; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      limit: "100",
      ...extraParams,
    });

    const response = await fetch(`${path}?${params}`, {
      cache: "no-store",
    });

    const result = await readResult<{
      data: T[];
      hasMore?: boolean;
    }>(response);

    output.push(...(result.data || []));

    if (!result.hasMore) return output;
  }

  throw new Error("Too many records to load. Narrow the selection.");
}

export default function FinanceTransactionsPage() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [advanceOptions, setAdvanceOptions] = useState<AdvanceOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("VALID");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [form, setForm] = useState<TransactionForm>(emptyForm());

  const [detail, setDetail] = useState<FinanceTransaction | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        status: statusFilter,
      });

      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (appliedStartDate) params.set("startDate", appliedStartDate);
      if (appliedEndDate) params.set("endDate", appliedEndDate);

      const response = await fetch(
        `/api/finance-transactions?${params}`,
        { cache: "no-store" },
      );

      const result = await readResult<{
        data: FinanceTransaction[];
        totalCount: number;
        totalAmount: number;
        hasMore: boolean;
      }>(response);

      const rows = result.data || [];
      const count = Number(result.totalCount || 0);

      if (
        rows.length === 0 &&
        page > 1 &&
        count <= (page - 1) * LIMIT
      ) {
        setPage(Math.max(1, Math.ceil(count / LIMIT)));
        return;
      }

      setTransactions(rows);
      setTotalCount(count);
      setTotalAmount(Number(result.totalAmount || 0));
      setHasMore(Boolean(result.hasMore));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load finance transactions.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    typeFilter,
    statusFilter,
    appliedStartDate,
    appliedEndDate,
  ]);

  const loadLookups = useCallback(async () => {
    try {
      setLookupLoading(true);

      const [partnerRows, borrowedLoans, partnerAdvances] =
        await Promise.all([
          fetchAllPages<Partner>("/api/partners"),
          fetchAllPages<Loan>("/api/loans", {
            status: "ACTIVE",
            direction: "BUSINESS_BORROWED",
          }),
          fetchAllPages<Loan>("/api/loans", {
            status: "ACTIVE",
            direction: "PARTNER_ADVANCE",
          }),
        ]);

      setPartners(partnerRows);

      setLoans(
        [...borrowedLoans, ...partnerAdvances].filter(
          (loan) =>
            loan.status === "ACTIVE" &&
            loan.outstandingPrincipal > 0,
        ),
      );

      const [advances, settlements] = await Promise.all([
        fetchAllPages<FinanceTransaction>(
          "/api/finance-transactions",
          {
            type: "BUSINESS_ADVANCE_GIVEN",
            status: "VALID",
          },
        ),
        fetchAllPages<FinanceTransaction>(
          "/api/finance-transactions",
          {
            type: "BUSINESS_ADVANCE_SETTLED",
            status: "VALID",
          },
        ),
      ]);

      const settledByAdvance = new Map<string, number>();

      for (const settlement of settlements) {
        const key = idOf(settlement.relatedTransactionId);
        if (!key) continue;

        settledByAdvance.set(
          key,
          (settledByAdvance.get(key) || 0) + settlement.amount,
        );
      }

      setAdvanceOptions(
        advances
          .map((advance) => ({
            ...advance,
            outstandingAmount: Math.max(
              0,
              advance.amount -
                (settledByAdvance.get(advance._id) || 0),
            ),
          }))
          .filter((advance) => advance.outstandingAmount > 0.005),
      );
    } catch (err) {
      console.error("Finance lookup loading error:", err);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  function setField<K extends keyof TransactionForm>(
    field: K,
    value: TransactionForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(transaction: FinanceTransaction) {
    if (
      transaction.status !== "VALID" ||
      isOpeningTransaction(transaction.type)
    ) {
      return;
    }

    setEditing(transaction);
    setForm({
      ...emptyForm(),
      type: transaction.type,
      partnerId: idOf(transaction.partnerId),
      loanId: idOf(transaction.loanId),
      relatedTransactionId: idOf(transaction.relatedTransactionId),
      settlementType: transaction.settlementType || "EXPENSE",
      amount: String(transaction.amount),
      transactionDate: dateInput(transaction.transactionDate),
      paymentMethod: transaction.paymentMethod,
      reference: transaction.reference || "",
      notes: transaction.notes || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
  }

  const applicableLoans = useMemo(() => {
    if (form.type === "LOAN_PRINCIPAL_REPAYMENT") {
      return loans.filter(
        (loan) => loan.direction === "BUSINESS_BORROWED",
      );
    }

    if (form.type === "PARTNER_ADVANCE_REPAID") {
      return loans.filter(
        (loan) => loan.direction === "PARTNER_ADVANCE",
      );
    }

    return [];
  }, [form.type, loans]);

  const selectedLoan = applicableLoans.find(
    (loan) => loan._id === form.loanId,
  );

  const selectedAdvance = advanceOptions.find(
    (advance) => advance._id === form.relatedTransactionId,
  );

  async function handleSave() {
    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid amount greater than zero.");
      return;
    }

    if (!form.transactionDate) {
      window.alert("Select the transaction date.");
      return;
    }

    if (requiresPartner(form.type) && !form.partnerId) {
      window.alert("Select a partner.");
      return;
    }

    if (requiresLoan(form.type) && !form.loanId) {
      window.alert("Select a loan.");
      return;
    }

    if (
      form.type === "BUSINESS_ADVANCE_SETTLED" &&
      !form.relatedTransactionId
    ) {
      window.alert("Select the original business advance.");
      return;
    }

    if (
      form.type === "BUSINESS_ADVANCE_SETTLED" &&
      form.settlementType !== "EXPENSE" &&
      form.settlementType !== "CASH_RETURN"
    ) {
      window.alert("Select the settlement type.");
      return;
    }

    if (selectedLoan && amount > selectedLoan.outstandingPrincipal + 0.005) {
      window.alert(
        `The amount cannot exceed the outstanding balance of ${formatPrice(
          selectedLoan.outstandingPrincipal,
        )}.`,
      );
      return;
    }

    if (
      selectedAdvance &&
      amount > selectedAdvance.outstandingAmount + 0.005
    ) {
      window.alert(
        `The amount cannot exceed the unsettled advance of ${formatPrice(
          selectedAdvance.outstandingAmount,
        )}.`,
      );
      return;
    }

    try {
      setSaving(true);

      const payload = editing
        ? {
            amount,
            transactionDate: form.transactionDate,
            paymentMethod: form.paymentMethod,
            reference: form.reference.trim(),
            notes: form.notes.trim(),
            settlementType:
              form.type === "BUSINESS_ADVANCE_SETTLED"
                ? form.settlementType
                : undefined,
          }
        : {
            type: form.type,
            partnerId: requiresPartner(form.type)
              ? form.partnerId
              : undefined,
            loanId: requiresLoan(form.type)
              ? form.loanId
              : undefined,
            relatedTransactionId:
              form.type === "BUSINESS_ADVANCE_SETTLED"
                ? form.relatedTransactionId
                : undefined,
            settlementType:
              form.type === "BUSINESS_ADVANCE_SETTLED"
                ? form.settlementType
                : undefined,
            amount,
            transactionDate: form.transactionDate,
            paymentMethod: form.paymentMethod,
            reference: form.reference.trim(),
            notes: form.notes.trim(),
          };

      const response = await fetch(
        editing
          ? `/api/finance-transactions/${editing._id}`
          : "/api/finance-transactions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      await readResult(response);

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm());

      window.alert(
        editing
          ? "Transaction updated successfully."
          : "Transaction recorded successfully.",
      );

      await Promise.all([loadTransactions(), loadLookups()]);
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to save transaction.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(transaction: FinanceTransaction) {
    if (isOpeningTransaction(transaction.type)) {
      window.alert(
        "This is a loan-opening transaction. Manage it from the Loans page.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${TYPE_LABELS[transaction.type]} for ${formatPrice(
        transaction.amount,
      )}?\n\nThe deletion will be recorded in the audit log.`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/finance-transactions/${transaction._id}`,
        { method: "DELETE" },
      );

      await readResult(response);

      window.alert("Transaction deleted successfully.");

      await Promise.all([loadTransactions(), loadLookups()]);
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to delete transaction.",
      );
    }
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (startDate && endDate && startDate > endDate) {
      window.alert("Start date cannot be later than end date.");
      return;
    }

    setPage(1);
    setSearch(searchInput.trim());
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  }

  const refreshAll = async () => {
    await Promise.all([loadTransactions(), loadLookups()]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Finance Transactions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Record and review partner capital, repayments, drawings, and business advances.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Matching Transactions
            </p>
            <CalendarDays className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {totalCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            All pages matching the active filters
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Matching Recorded Amounts
            </p>
            <Wallet className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatPrice(totalAmount)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Gross sum of transaction amounts, not net profit or cash balance
          </p>
        </div>
      </div>

      {/* Filters */}
      <form
        onSubmit={applyFilters}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(200px,1fr)_220px_160px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search partner, reference, or notes..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => {
              setPage(1);
              setTypeFilter(event.target.value);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
          >
            <option value="ALL">All Transaction Types</option>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
          >
            <option value="VALID">Valid Only</option>
            <option value="VOIDED">Voided Only</option>
            <option value="ALL">All Statuses</option>
          </select>

          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={loading || lookupLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setTypeFilter("ALL");
                setStatusFilter("VALID");
                setStartDate("");
                setEndDate("");
                setAppliedStartDate("");
                setAppliedEndDate("");
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
      </form>

      {/* Transaction table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Transaction Ledger
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
              onClick={() => void loadTransactions()}
              className="mt-3 text-sm font-medium text-slate-900 underline"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex h-56 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
            <Wallet className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No finance transactions found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add an entry or change your search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {[
                    "Date",
                    "Transaction",
                    "Partner / Lender",
                    "Amount",
                    "Method",
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
                {transactions.map((transaction) => {
                  const opening = isOpeningTransaction(transaction.type);
                  const incoming = signForType(transaction.type) === "in";

                  return (
                    <tr
                      key={transaction._id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {formatDate(transaction.transactionDate)}
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {TYPE_LABELS[transaction.type]}
                        </p>
                        {transaction.notes && (
                          <p className="mt-1 max-w-64 truncate text-xs text-slate-400">
                            {transaction.notes}
                          </p>
                        )}
                        {transaction.settlementType && (
                          <p className="mt-1 text-xs text-slate-500">
                            {transaction.settlementType === "EXPENSE"
                              ? "Expense settlement"
                              : "Cash returned"}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {partnerName(transaction.partnerId) !== "—"
                          ? partnerName(transaction.partnerId)
                          : loanName(transaction.loanId)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                            incoming ? "text-emerald-700" : "text-slate-900"
                          }`}
                        >
                          {incoming ? (
                            <ArrowDownLeft className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                          {formatPrice(transaction.amount)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {transaction.paymentMethod}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            transaction.status === "VALID"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {transaction.status}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetail(transaction)}
                            title="View details"
                            aria-label="View transaction details"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {transaction.status === "VALID" && !opening && (
                            <button
                              type="button"
                              onClick={() => openEdit(transaction)}
                              title="Edit transaction"
                              aria-label="Edit transaction"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          {!opening && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(transaction)}
                              title="Delete transaction"
                              aria-label="Delete transaction"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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

      {/* Add / Edit transaction */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
            className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2
                  id="transaction-modal-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {editing ? "Edit Transaction" : "Add Transaction"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Amounts are validated by the server before saving.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {!editing && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Transaction Type *
                  </label>

                  <select
                    value={form.type}
                    onChange={(event) => {
                      const type = event.target.value as FinanceType;

                      setForm((current) => ({
                        ...current,
                        type,
                        partnerId: "",
                        loanId: "",
                        relatedTransactionId: "",
                        settlementType: "EXPENSE",
                      }));
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                  >
                    {CREATABLE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>

                  {form.type === "BUSINESS_ADVANCE_GIVEN" && (
                    <p className="mt-2 text-xs text-slate-500">
                      Use this for temporary money given to a partner for a business purpose.
                    </p>
                  )}
                </div>
              )}

              {editing && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {TYPE_LABELS[editing.type]}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Transaction type and linked account cannot be changed here.
                  </p>
                </div>
              )}

              {requiresPartner(form.type) && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Partner *
                  </label>
                  <select
                    value={form.partnerId}
                    disabled={Boolean(editing)}
                    onChange={(event) =>
                      setField("partnerId", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 disabled:bg-slate-100"
                  >
                    <option value="">Select partner</option>
                    {partners.map((partner) => (
                      <option key={partner._id} value={partner._id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                  {partners.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Add a partner first, then record the transaction.
                    </p>
                  )}
                </div>
              )}

              {requiresLoan(form.type) && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Loan *
                  </label>

                  <select
                    value={form.loanId}
                    disabled={Boolean(editing)}
                    onChange={(event) =>
                      setField("loanId", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 disabled:bg-slate-100"
                  >
                    <option value="">Select active loan</option>
                    {applicableLoans.map((loan) => (
                      <option key={loan._id} value={loan._id}>
                        {loan.counterpartyName} — Outstanding{" "}
                        {formatPrice(loan.outstandingPrincipal)}
                      </option>
                    ))}
                  </select>

                  {selectedLoan && (
                    <p className="mt-1 text-xs text-slate-500">
                      Outstanding: {formatPrice(selectedLoan.outstandingPrincipal)}
                    </p>
                  )}

                  {applicableLoans.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No active loan of this type has an outstanding balance.
                    </p>
                  )}
                </div>
              )}

              {form.type === "BUSINESS_ADVANCE_SETTLED" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Original Business Advance *
                    </label>
                    <select
                      value={form.relatedTransactionId}
                      disabled={Boolean(editing)}
                      onChange={(event) =>
                        setField("relatedTransactionId", event.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 disabled:bg-slate-100"
                    >
                      <option value="">Select unsettled advance</option>
                      {advanceOptions.map((advance) => (
                        <option key={advance._id} value={advance._id}>
                          {partnerName(advance.partnerId)} — Remaining{" "}
                          {formatPrice(advance.outstandingAmount)}
                        </option>
                      ))}
                    </select>

                    {selectedAdvance && (
                      <p className="mt-1 text-xs text-slate-500">
                        Remaining to settle:{" "}
                        {formatPrice(selectedAdvance.outstandingAmount)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Settlement Type *
                    </label>
                    <select
                      value={form.settlementType}
                      onChange={(event) =>
                        setField(
                          "settlementType",
                          event.target.value as SettlementType,
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                    >
                      <option value="EXPENSE">Business expense supported by records</option>
                      <option value="CASH_RETURN">Unused cash returned</option>
                    </select>

                    <p className="mt-1 text-xs text-slate-500">
                      Record the actual expense in General Expenses or Vehicle Expenses separately, where applicable. Do not count the same cost twice.
                    </p>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Amount (JPY) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      setField("amount", event.target.value)
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Transaction Date *
                  </label>
                  <input
                    type="date"
                    value={form.transactionDate}
                    onChange={(event) =>
                      setField("transactionDate", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Payment Method
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(event) =>
                      setField(
                        "paymentMethod",
                        event.target.value as PaymentMethod,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                  >
                    {METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Reference
                  </label>
                  <input
                    value={form.reference}
                    onChange={(event) =>
                      setField("reference", event.target.value)
                    }
                    maxLength={150}
                    placeholder="Optional receipt/reference"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setField("notes", event.target.value)
                  }
                  maxLength={2000}
                  placeholder="Reason, purpose, or additional details..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
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
                disabled={saving || lookupLoading}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editing
                    ? "Update Transaction"
                    : "Save Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View transaction details */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-detail-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="transaction-detail-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Transaction Details
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {TYPE_LABELS[detail.type]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close details"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ["Amount", formatPrice(detail.amount)],
                ["Date", formatDate(detail.transactionDate)],
                ["Payment Method", detail.paymentMethod],
                ["Status", detail.status],
                ["Partner", partnerName(detail.partnerId)],
                ["Loan / Lender", loanName(detail.loanId)],
                ["Reference", detail.reference || "—"],
                [
                  "Settlement",
                  detail.settlementType || "—",
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-900">
                    {value}
                  </p>
                </div>
              ))}

              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-500">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {detail.notes || "No notes"}
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setDetail(null)}
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
