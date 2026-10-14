"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
import { formatDate, formatMoney } from "@/lib/format";

/* ----------------------------- types ----------------------------- */

type Partner = { _id: string; name: string };

type Overview = {
  cashEstimate: number;
  moneyIn: {
    fromCustomers: number;
    partnersPutIn: number;
    borrowed: number;
    lentBackByPartners: number;
  };
  moneyOut: {
    carsBought: number;
    carExpenses: number;
    generalExpenses: number;
    partnersMoneyReturned: number;
    partnersPersonalUse: number;
    loansPaidBack: number;
    lentToPartners: number;
    stillWithPartners: number;
  };
  customersOwe: number;
  partnersOweLoans: number;
  stillWithPartners: number;
  youOwe: number;
  openLoans: { _id: string; direction: string; name: string; outstanding: number }[];
  openAdvances: { _id: string; partnerName: string; remaining: number }[];
};

type Tx = {
  _id: string;
  type: string;
  partnerId?: { name?: string } | string | null;
  loanId?: { counterpartyName?: string } | string | null;
  settlementType?: string | null;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
  notes?: string;
};

type Need = "partner" | "loan" | "advance" | "lender";

type Action = {
  id: string;
  group: string;
  title: string;
  hint: string;
  flow: "in" | "out" | "none";
  kind: "tx" | "loan";
  type?: string;
  loanDirection?: "BUSINESS_BORROWED" | "PARTNER_ADVANCE";
  need: Need;
};

/* ------------------- plain-language action list ------------------- */

const ACTIONS: Action[] = [
  {
    id: "partner_in",
    group: "Partner money",
    title: "A partner put money into the business",
    hint: "Example: Ali gave 500,000 to buy cars",
    flow: "in",
    kind: "tx",
    type: "PARTNER_CONTRIBUTION",
    need: "partner",
  },
  {
    id: "partner_back",
    group: "Partner money",
    title: "We gave a partner's money back",
    hint: "Returning the money the partner put in earlier",
    flow: "out",
    kind: "tx",
    type: "PARTNER_CAPITAL_RETURN",
    need: "partner",
  },
  {
    id: "partner_took",
    group: "Partner money",
    title: "A partner took money for personal use",
    hint: "Money taken out of the business for the partner's own needs",
    flow: "out",
    kind: "tx",
    type: "PARTNER_DRAWING",
    need: "partner",
  },
  {
    id: "borrowed",
    group: "Borrowed money",
    title: "We borrowed money",
    hint: "From a bank, a person, or a partner. You will pay it back later.",
    flow: "in",
    kind: "loan",
    loanDirection: "BUSINESS_BORROWED",
    need: "lender",
  },
  {
    id: "repay",
    group: "Borrowed money",
    title: "We paid back borrowed money",
    hint: "A full or part payment of money we borrowed",
    flow: "out",
    kind: "tx",
    type: "LOAN_PRINCIPAL_REPAYMENT",
    need: "loan",
  },
  {
    id: "lent",
    group: "Lent to a partner",
    title: "We lent money to a partner",
    hint: "The partner must pay this back to the business",
    flow: "out",
    kind: "loan",
    loanDirection: "PARTNER_ADVANCE",
    need: "partner",
  },
  {
    id: "lent_back",
    group: "Lent to a partner",
    title: "A partner paid back what we lent",
    hint: "A full or part payment from the partner",
    flow: "in",
    kind: "tx",
    type: "PARTNER_ADVANCE_REPAID",
    need: "loan",
  },
  {
    id: "adv_given",
    group: "Money for business work",
    title: "We gave a partner money to spend on business",
    hint: "Example: cash for a trip to buy a car or pay for repairs",
    flow: "out",
    kind: "tx",
    type: "BUSINESS_ADVANCE_GIVEN",
    need: "partner",
  },
  {
    id: "adv_settled",
    group: "Money for business work",
    title: "Partner reported how that money was used",
    hint: "Spent on business, or leftover cash returned",
    flow: "none",
    kind: "tx",
    type: "BUSINESS_ADVANCE_SETTLED",
    need: "advance",
  },
];

const GROUPS = Array.from(new Set(ACTIONS.map((a) => a.group)));

const METHODS = [
  ["CASH", "Cash"],
  ["BANK", "Bank transfer"],
  ["ONLINE", "Online / mobile app"],
  ["OTHER", "Other"],
] as const;

const OPENING_TYPES = ["LOAN_RECEIVED", "PARTNER_ADVANCE_GIVEN"];
const MONEY_IN_TYPES = [
  "PARTNER_CONTRIBUTION",
  "LOAN_RECEIVED",
  "PARTNER_ADVANCE_REPAID",
];

/* ----------------------------- helpers ----------------------------- */

function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const nameOf = (v: unknown, key: "name" | "counterpartyName") =>
  v && typeof v === "object" ? ((v as any)[key] as string) : undefined;

function describe(tx: Tx) {
  const who = nameOf(tx.partnerId, "name") ?? "A partner";
  const loan = nameOf(tx.loanId, "counterpartyName") ?? "someone";

  switch (tx.type) {
    case "PARTNER_CONTRIBUTION":
      return `${who} put money into the business`;
    case "PARTNER_CAPITAL_RETURN":
      return `Gave ${who}'s money back`;
    case "PARTNER_DRAWING":
      return `${who} took money for personal use`;
    case "LOAN_RECEIVED":
      return `Borrowed money from ${loan}`;
    case "LOAN_PRINCIPAL_REPAYMENT":
      return `Paid back ${loan}`;
    case "PARTNER_ADVANCE_GIVEN":
      return `Lent money to ${loan}`;
    case "PARTNER_ADVANCE_REPAID":
      return `${loan} paid back our loan`;
    case "BUSINESS_ADVANCE_GIVEN":
      return `Gave ${who} money to spend on business`;
    case "BUSINESS_ADVANCE_SETTLED":
      return tx.settlementType === "CASH_RETURN"
        ? `${who} returned unused cash`
        : `${who} spent the money on business`;
    default:
      return tx.type;
  }
}

function flowOf(tx: Tx): "in" | "out" | "none" {
  if (MONEY_IN_TYPES.includes(tx.type)) return "in";
  if (tx.type === "BUSINESS_ADVANCE_SETTLED") {
    return tx.settlementType === "CASH_RETURN" ? "in" : "none";
  }
  return "out";
}

const emptyForm = () => ({
  partnerId: "",
  loanId: "",
  advanceId: "",
  lenderName: "",
  settleKind: "EXPENSE" as "EXPENSE" | "CASH_RETURN",
  amount: "",
  date: todayStr(),
  method: "CASH",
  notes: "",
});

/* ------------------------------ page ------------------------------ */

export default function MoneyPage() {
  const confirm = useConfirm();

  const [ov, setOv] = useState<Overview | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [diary, setDiary] = useState<Tx[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/overview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setOv(json.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load money summary");
    }
  }, []);

  const loadDiary = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        status: "VALID",
      });
      const res = await fetch(`/api/finance-transactions?${params}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setDiary(json.data || []);
      setHasMore(Boolean(json.hasMore));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load entries");
    }
  }, [page]);

  const loadPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/partners?page=1&limit=100", {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success) setPartners(json.data || []);
    } catch {
      /* partners are optional until needed */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOverview(), loadDiary()]);
    setLoading(false);
  }, [loadOverview, loadDiary]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  /* ----------------------------- modal ----------------------------- */

  const openChooser = () => {
    setAction(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
    setAction(null);
  };

  const set = (patch: Partial<ReturnType<typeof emptyForm>>) =>
    setForm((f) => ({ ...f, ...patch }));

  const loanChoices =
    ov?.openLoans.filter((l) =>
      action?.id === "repay"
        ? l.direction === "BUSINESS_BORROWED"
        : l.direction === "PARTNER_ADVANCE",
    ) ?? [];

  const selectedLoan = loanChoices.find((l) => l._id === form.loanId);
  const selectedAdvance = ov?.openAdvances.find(
    (a) => a._id === form.advanceId,
  );
  const maxAmount = selectedLoan?.outstanding ?? selectedAdvance?.remaining;

  async function save() {
    if (!action) return;

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter the amount.");
      return;
    }
    if (!form.date) {
      toast.error("Please choose the date.");
      return;
    }
    if (action.need === "partner" && !form.partnerId) {
      toast.error("Please choose the partner.");
      return;
    }
    if (action.need === "loan" && !form.loanId) {
      toast.error("Please choose which loan.");
      return;
    }
    if (action.need === "advance" && !form.advanceId) {
      toast.error("Please choose which money this is about.");
      return;
    }
    if (
      action.need === "lender" &&
      !form.partnerId &&
      !form.lenderName.trim()
    ) {
      toast.error("Please enter who lent you the money.");
      return;
    }
    if (maxAmount !== undefined && amount > maxAmount + 0.005) {
      toast.error(`The amount cannot be more than ${formatMoney(maxAmount)}.`);
      return;
    }

    try {
      setSaving(true);

      let url = "/api/finance-transactions";
      let body: Record<string, unknown>;

      if (action.kind === "loan") {
        const partner = partners.find((p) => p._id === form.partnerId);
        const isPartner = Boolean(form.partnerId);

        url = "/api/loans";
        body = {
          direction: action.loanDirection,
          counterpartyType: isPartner ? "PARTNER" : "INDIVIDUAL",
          counterpartyName: isPartner
            ? partner?.name || ""
            : form.lenderName.trim(),
          partnerId: isPartner ? form.partnerId : undefined,
          principalAmount: amount,
          loanDate: form.date,
          paymentMethod: form.method,
          notes: form.notes.trim(),
        };
      } else {
        body = {
          type: action.type,
          partnerId: action.need === "partner" ? form.partnerId : undefined,
          loanId: action.need === "loan" ? form.loanId : undefined,
          relatedTransactionId:
            action.need === "advance" ? form.advanceId : undefined,
          settlementType:
            action.need === "advance" ? form.settleKind : undefined,
          amount,
          transactionDate: form.date,
          paymentMethod: form.method,
          notes: form.notes.trim(),
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success("Saved.");
      setOpen(false);
      setAction(null);
      setPage(1);
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(tx: Tx) {
    if (OPENING_TYPES.includes(tx.type)) {
      toast.error("To remove this, delete the loan from the Loans page.");
      return;
    }

    const ok = await confirm({
      title: "Delete this entry?",
      description: `${describe(tx)} — ${formatMoney(tx.amount)}`,
      confirmText: "Delete",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/finance-transactions/${tx._id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      toast.success("Deleted.");
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  /* ----------------------------- render ----------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Money
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            See where your money came from, where it went, and who owes whom.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openChooser}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add money entry
          </button>
        </div>
      </div>

      {!ov ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
        </div>
      ) : (
        <>
          {/* Big number */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Money you should have right now
            </p>
            <p
              className={`mt-2 text-4xl font-bold ${
                ov.cashEstimate >= 0 ? "text-slate-900" : "text-red-600"
              }`}
            >
              {formatMoney(ov.cashEstimate)}
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This is an estimate worked out from everything recorded in the
              system (cash, bank and online together). If you bought cars
              before you started using this system, the number will be lower
              than reality.
            </p>
          </div>

          {/* Who owes whom */}
          <div className="grid gap-4 md:grid-cols-3">
            <OweCard
              title="Customers still owe you"
              value={ov.customersOwe}
              tone="amber"
              hint="Unpaid balance on cars you sold"
              href="/sales"
              linkText="Go to Sales"
            />
            <OweCard
              title="Partners owe you"
              value={ov.partnersOweLoans + ov.stillWithPartners}
              tone="amber"
              hint={`Loans ${formatMoney(ov.partnersOweLoans)} · Business cash they hold ${formatMoney(
                ov.stillWithPartners,
              )}`}
              href="/finance/loans"
              linkText="See loans"
            />
            <OweCard
              title="You owe others"
              value={ov.youOwe}
              tone="red"
              hint="Borrowed money not yet paid back"
              href="/finance/loans"
              linkText="See loans"
            />
          </div>

          {/* In / Out */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Money came in" total={sum(ov.moneyIn)} tone="green">
              <Row
                label="Payments from customers"
                hint="After refunds"
                value={ov.moneyIn.fromCustomers}
                href="/payments"
              />
              <Row label="Partners put money in" value={ov.moneyIn.partnersPutIn} />
              <Row label="Money we borrowed" value={ov.moneyIn.borrowed} />
              <Row
                label="Partners paid back loans"
                value={ov.moneyIn.lentBackByPartners}
              />
            </Panel>

            <Panel title="Money went out" total={sum(ov.moneyOut)} tone="red">
              <Row
                label="Cars bought"
                value={ov.moneyOut.carsBought}
                href="/inventory"
              />
              <Row
                label="Car expenses (repairs, etc.)"
                value={ov.moneyOut.carExpenses}
                href="/expenses/vehicle"
              />
              <Row
                label="Shop / office expenses"
                value={ov.moneyOut.generalExpenses}
                href="/expenses/general"
              />
              <Row
                label="Partners' money given back"
                value={ov.moneyOut.partnersMoneyReturned}
              />
              <Row
                label="Partners took for personal use"
                value={ov.moneyOut.partnersPersonalUse}
              />
              <Row label="Loans we paid back" value={ov.moneyOut.loansPaidBack} />
              <Row
                label="Money lent to partners"
                value={ov.moneyOut.lentToPartners}
              />
              <Row
                label="Business cash held by partners"
                hint="Given for business work, not yet reported"
                value={ov.moneyOut.stillWithPartners}
              />
            </Panel>
          </div>

          {/* Plain explanation */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
            <p className="font-semibold">Is this the same as profit?</p>
            <p className="mt-1 text-sky-800">
              No. Money from partners or loans is not income, and paying loans
              back is not an expense. Your real profit only comes from selling
              cars for more than they cost you, minus your expenses. You can
              see that in{" "}
              <Link href="/reports" className="font-semibold underline">
                Reports
              </Link>
              .
            </p>
          </div>
        </>
      )}

      {/* Diary */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent money entries
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Partner and loan entries you added. Sales, payments and expenses
            appear in their own pages.
          </p>
        </div>

        {diary.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Nothing yet. Press “Add money entry” to start.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {diary.map((tx) => {
              const flow = flowOf(tx);
              return (
                <div
                  key={tx._id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        flow === "in"
                          ? "bg-emerald-50 text-emerald-600"
                          : flow === "out"
                            ? "bg-red-50 text-red-600"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {flow === "in" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : flow === "out" ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {describe(tx)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {formatDate(tx.transactionDate)} ·{" "}
                        {METHODS.find((m) => m[0] === tx.paymentMethod)?.[1] ??
                          tx.paymentMethod}
                        {tx.notes ? ` · ${tx.notes}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-bold ${
                        flow === "in"
                          ? "text-emerald-600"
                          : flow === "out"
                            ? "text-slate-900"
                            : "text-slate-500"
                      }`}
                    >
                      {flow === "in" ? "+" : flow === "out" ? "−" : ""}
                      {formatMoney(tx.amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void remove(tx)}
                      title="Delete"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-sm text-slate-500">Page {page}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {action ? action.title : "What happened?"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {action ? action.hint : "Pick the one that matches."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1: choose */}
            {!action && (
              <div className="space-y-5 p-5">
                {GROUPS.map((group) => (
                  <div key={group}>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      {group}
                    </p>
                    <div className="space-y-2">
                      {ACTIONS.filter((a) => a.group === group).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setAction(a);
                            setForm(emptyForm());
                          }}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {a.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {a.hint}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 2: form */}
            {action && (
              <>
                <div className="space-y-4 p-5">
                  {(action.need === "partner" || action.need === "lender") && (
                    <Field
                      label={
                        action.need === "lender"
                          ? "Who lent you the money?"
                          : "Which partner?"
                      }
                    >
                      <select
                        value={form.partnerId}
                        onChange={(e) => set({ partnerId: e.target.value })}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                      >
                        <option value="">
                          {action.need === "lender"
                            ? "Someone else (bank, friend, other)"
                            : "Select partner"}
                        </option>
                        {partners.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {partners.length === 0 && action.need === "partner" && (
                        <p className="mt-1 text-xs text-amber-700">
                          No partners yet. Add one on the{" "}
                          <Link href="/finance/partners" className="underline">
                            Partners page
                          </Link>
                          .
                        </p>
                      )}
                    </Field>
                  )}

                  {action.need === "lender" && !form.partnerId && (
                    <Field label="Name of lender">
                      <input
                        value={form.lenderName}
                        onChange={(e) => set({ lenderName: e.target.value })}
                        maxLength={150}
                        placeholder="e.g. HBL Bank, Bilal Ahmed"
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                      />
                    </Field>
                  )}

                  {action.need === "loan" && (
                    <Field label="Which loan?">
                      <select
                        value={form.loanId}
                        onChange={(e) => set({ loanId: e.target.value })}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                      >
                        <option value="">Select</option>
                        {loanChoices.map((l) => (
                          <option key={l._id} value={l._id}>
                            {l.name} — still {formatMoney(l.outstanding)}
                          </option>
                        ))}
                      </select>
                      {loanChoices.length === 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          Nothing is pending here.
                        </p>
                      )}
                    </Field>
                  )}

                  {action.need === "advance" && (
                    <>
                      <Field label="Which money given to a partner?">
                        <select
                          value={form.advanceId}
                          onChange={(e) => set({ advanceId: e.target.value })}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                        >
                          <option value="">Select</option>
                          {ov?.openAdvances.map((a) => (
                            <option key={a._id} value={a._id}>
                              {a.partnerName} — still {formatMoney(a.remaining)}
                            </option>
                          ))}
                        </select>
                        {ov?.openAdvances.length === 0 && (
                          <p className="mt-1 text-xs text-amber-700">
                            No partner is holding business money right now.
                          </p>
                        )}
                      </Field>

                      <Field label="What happened to it?">
                        <select
                          value={form.settleKind}
                          onChange={(e) =>
                            set({
                              settleKind: e.target.value as
                                | "EXPENSE"
                                | "CASH_RETURN",
                            })
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                        >
                          <option value="EXPENSE">
                            Partner spent it on business
                          </option>
                          <option value="CASH_RETURN">
                            Partner returned the leftover cash
                          </option>
                        </select>
                        {form.settleKind === "EXPENSE" && (
                          <p className="mt-1 text-xs text-slate-500">
                            Also add the actual cost in Expenses (car or
                            general) so your profit is correct. The Money page
                            will not count it twice.
                          </p>
                        )}
                      </Field>
                    </>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Amount">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => set({ amount: e.target.value })}
                        placeholder="0"
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                      />
                      {maxAmount !== undefined && (
                        <button
                          type="button"
                          onClick={() => set({ amount: String(maxAmount) })}
                          className="mt-1 text-xs font-medium text-sky-700 hover:underline"
                        >
                          Use full amount ({formatMoney(maxAmount)})
                        </button>
                      )}
                    </Field>

                    <Field label="Date">
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => set({ date: e.target.value })}
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
                      />
                    </Field>
                  </div>

                  <Field label="How was it paid?">
                    <select
                      value={form.method}
                      onChange={(e) => set({ method: e.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                    >
                      {METHODS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Note (optional)">
                    <textarea
                      rows={2}
                      value={form.notes}
                      maxLength={2000}
                      onChange={(e) => set({ notes: e.target.value })}
                      placeholder="Anything you want to remember..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </Field>
                </div>

                <div className="flex justify-between border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setAction(null)}
                    disabled={saving}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- small components ------------------------- */

function sum(o: Record<string, number>) {
  return Object.values(o).reduce((a, b) => a + b, 0);
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

function OweCard({
  title,
  value,
  hint,
  tone,
  href,
  linkText,
}: {
  title: string;
  value: number;
  hint: string;
  tone: "amber" | "red";
  href: string;
  linkText: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          tone === "red" ? "text-red-600" : "text-amber-600"
        }`}
      >
        {formatMoney(value)}
      </p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
      <Link
        href={href}
        className="mt-3 inline-block text-xs font-semibold text-sky-700 hover:underline"
      >
        {linkText} →
      </Link>
    </div>
  );
}

function Panel({
  title,
  total,
  tone,
  children,
}: {
  title: string;
  total: number;
  tone: "green" | "red";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p
          className={`text-base font-bold ${
            tone === "green" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {formatMoney(total)}
        </p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
}) {
  if (!value) return null; // hide empty lines so it stays simple

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {href ? (
          <Link
            href={href}
            className="text-sm text-slate-700 hover:text-sky-700 hover:underline"
          >
            {label}
          </Link>
        ) : (
          <span className="text-sm text-slate-700">{label}</span>
        )}
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <span className="text-sm font-semibold text-slate-900">
        {formatMoney(value)}
      </span>
    </div>
  );
}