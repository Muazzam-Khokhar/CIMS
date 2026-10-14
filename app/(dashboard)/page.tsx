"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  CarFront,
  CircleDollarSign,
  RefreshCw,
  ShoppingCart,
  Undo2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";

type Dashboard = {
  stock: {
    count: number;
    cost: number;
    soldSoFar: number;
    oldest: { _id: string; name: string; days: number; cost: number }[];
  };
  month: {
    label: string;
    soldCount: number;
    soldValue: number;
    received: number;
    refunded: number;
  };
  outstanding: number;
  owedList: { saleId: string; name: string; price: number; remaining: number; days: number }[];
  chart: { label: string; sales: number; received: number }[];
  loansDue: {
    _id: string;
    direction: string;
    name: string;
    outstanding: number;
    dueDate: string;
    overdue: boolean;
  }[];
  activity: {
    id: string;
    kind: "sale" | "payment" | "refund" | "return";
    title: string;
    amount: number;
    date: string;
  }[];
  money: { cash: number; youOwe: number; partnersOwe: number } | null;
};

const KIND = {
  sale: { label: "Car sold", icon: ShoppingCart, cls: "bg-blue-50 text-blue-600", sign: "" },
  payment: { label: "Payment received", icon: ArrowDownLeft, cls: "bg-emerald-50 text-emerald-600", sign: "+" },
  refund: { label: "Money returned to customer", icon: Undo2, cls: "bg-red-50 text-red-600", sign: "−" },
  return: { label: "Sale cancelled, refunded", icon: Undo2, cls: "bg-red-50 text-red-600", sign: "−" },
} as const;

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setData(json.data);
    } catch (e) {
      setData(null);
      toast.error(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  const chartMax = Math.max(1, ...data.chart.flatMap((c) => [c.sales, Math.max(c.received, 0)]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            What needs your attention today · {data.month.label}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Main cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cars in stock"
          value={String(data.stock.count)}
          note={`Cost you ${formatMoney(data.stock.cost)} so far`}
          icon={<CarFront className="h-5 w-5" />}
          tone="bg-blue-50 text-blue-600"
          href="/inventory"
        />
        <StatCard
          label="Sold this month"
          value={String(data.month.soldCount)}
          note={`Worth ${formatMoney(data.month.soldValue)}`}
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="bg-violet-50 text-violet-600"
          href="/sales"
        />
        <StatCard
          label="Money received this month"
          value={formatMoney(data.month.received)}
          note={
            data.month.refunded > 0
              ? `After returning ${formatMoney(data.month.refunded)}`
              : "From customers"
          }
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-600"
          href="/payments"
        />
        <StatCard
          label="Customers still owe you"
          value={formatMoney(data.outstanding)}
          note={`${data.owedList.length ? "Unpaid balance on sold cars" : "Everyone has paid"}`}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600"
          valueClass={data.outstanding > 0 ? "text-amber-600" : undefined}
          href="/sales"
        />
      </div>

      {/* Money snapshot */}
      {data.money && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Your money</h2>
            <Link href="/finance" className="text-xs font-semibold text-sky-700 hover:underline">
              Open Money →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Mini label="Money you should have" value={data.money.cash} tone={data.money.cash >= 0 ? "text-slate-900" : "text-red-600"} />
            <Mini label="You owe others" value={data.money.youOwe} tone="text-red-600" />
            <Mini label="Partners owe you" value={data.money.partnersOwe} tone="text-amber-600" />
          </div>
        </div>
      )}

      {/* Chart + customers */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Last 6 months" subtitle="Cars sold compared with money received">
          <div className="flex h-44 items-end gap-3">
            {data.chart.map((c) => (
              <div key={c.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <div
                    title={`Sold ${formatMoney(c.sales)}`}
                    className="w-full max-w-4 rounded-t bg-sky-500"
                    style={{ height: `${Math.max((c.sales / chartMax) * 100, c.sales ? 3 : 0)}%` }}
                  />
                  <div
                    title={`Received ${formatMoney(c.received)}`}
                    className="w-full max-w-4 rounded-t bg-emerald-500"
                    style={{ height: `${Math.max((Math.max(c.received, 0) / chartMax) * 100, c.received > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{c.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Sold</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Received</span>
          </div>
        </Panel>

        <Panel title="Customers who still owe you" subtitle="Oldest unpaid first" link={{ href: "/sales", text: "All sales" }}>
          {data.owedList.length === 0 ? (
            <Empty text="No unpaid balances. Great!" />
          ) : (
            <List>
              {data.owedList.map((o) => (
                <Row
                  key={o.saleId}
                  title={o.name}
                  sub={`Sold ${o.days} day${o.days === 1 ? "" : "s"} ago for ${formatMoney(o.price)}`}
                  right={formatMoney(o.remaining)}
                  rightClass="text-amber-600"
                />
              ))}
            </List>
          )}
        </Panel>
      </div>

      {/* Stock + loans */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Waiting longest in stock" subtitle="Cars that haven't sold yet" link={{ href: "/inventory", text: "Inventory" }}>
          {data.stock.oldest.length === 0 ? (
            <Empty text="No cars in stock." />
          ) : (
            <List>
              {data.stock.oldest.map((v) => (
                <Row
                  key={v._id}
                  title={v.name}
                  sub={`Cost ${formatMoney(v.cost)}`}
                  right={`${v.days} day${v.days === 1 ? "" : "s"}`}
                  rightClass={v.days > 60 ? "text-red-600" : "text-slate-900"}
                />
              ))}
            </List>
          )}
        </Panel>

        <Panel title="Loans to watch" subtitle="Overdue or due in the next 14 days" link={{ href: "/finance/loans", text: "All loans" }}>
          {data.loansDue.length === 0 ? (
            <Empty text="Nothing due soon." />
          ) : (
            <List>
              {data.loansDue.map((l) => (
                <Row
                  key={l._id}
                  title={l.direction === "BUSINESS_BORROWED" ? `You owe ${l.name}` : `${l.name} owes you`}
                  sub={`${l.overdue ? "Was due" : "Due"} ${formatDate(l.dueDate)}`}
                  right={formatMoney(l.outstanding)}
                  rightClass={l.overdue ? "text-red-600" : "text-slate-900"}
                />
              ))}
            </List>
          )}
        </Panel>
      </div>

      {/* Activity */}
      <Panel title="Recent activity" subtitle="Sales and payments, newest first">
        {data.activity.length === 0 ? (
          <Empty text="Nothing yet." />
        ) : (
          <List>
            {data.activity.map((a) => {
              const k = KIND[a.kind];
              const Icon = k.icon;
              return (
                <div key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${k.cls}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500">
                        {k.label} · {formatDate(a.date)}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${a.kind === "payment" ? "text-emerald-600" : a.kind === "sale" ? "text-slate-900" : "text-red-600"}`}>
                    {k.sign}
                    {formatMoney(a.amount)}
                  </p>
                </div>
              );
            })}
          </List>
        )}
      </Panel>

      <p className="text-center text-xs text-slate-400">
        Want to know your profit? Open{" "}
        <Link href="/reports" className="font-semibold text-sky-700 hover:underline">
          Reports
        </Link>
        .
      </p>
    </div>
  );
}

/* ----------------------------- small parts ----------------------------- */

function StatCard({
  label, value, note, icon, tone, href, valueClass = "text-slate-900",
}: {
  label: string; value: string; note: string; icon: React.ReactNode;
  tone: string; href: string; valueClass?: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className={`mt-2 truncate text-2xl font-bold ${valueClass}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-400">{note}</p>
        </div>
        <div className={`shrink-0 rounded-xl p-3 ${tone}`}>{icon}</div>
      </div>
    </Link>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{formatMoney(value)}</p>
    </div>
  );
}

function Panel({
  title, subtitle, link, children,
}: {
  title: string; subtitle?: string; link?: { href: string; text: string }; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {link && (
          <Link href={link.href} className="shrink-0 text-xs font-semibold text-sky-700 hover:underline">
            {link.text} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

const List = ({ children }: { children: React.ReactNode }) => (
  <div className="divide-y divide-slate-100">{children}</div>
);

const Empty = ({ text }: { text: string }) => (
  <p className="py-8 text-center text-sm text-slate-500">{text}</p>
);

function Row({ title, sub, right, rightClass = "text-slate-900" }: {
  title: string; sub: string; right: string; rightClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
      <p className={`shrink-0 text-sm font-bold ${rightClass}`}>{right}</p>
    </div>
  );
}