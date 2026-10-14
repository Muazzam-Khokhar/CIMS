"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CarFront } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";

type Preset = "this_month" | "last_month" | "last_3" | "this_year" | "custom";

type Report = {
  summary: {
    salesCount: number;
    salesTotal: number;
    carsCost: number;
    carExpensesOnSold: number;
    grossProfit: number;
    shopExpenses: number;
    netProfit: number;
    received: number;
    refunded: number;
    netReceived: number;
    outstanding: number;
    returnsCount: number;
    returnsRefunded: number;
  };
  byMethod: { method: string; total: number }[];
  shopExpenses: { title: string; total: number; count: number }[];
  sold: {
    saleId: string;
    vehicle: { name?: string; model?: string; chassisNumber?: string };
    saleType: "CUSTOMER" | "AUCTION";
    saleDate: string;
    purchasePrice: number;
    carExpenses: number;
    cost: number;
    salePrice: number;
    profit: number;
    remaining: number;
  }[];
};

const PRESETS: [Preset, string][] = [
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["last_3", "Last 3 months"],
  ["this_year", "This year"],
  ["custom", "Pick dates"],
];

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  ONLINE: "Online / mobile app",
  OTHER: "Other",
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rangeFor(preset: Preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case "this_month":
      return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
    case "last_month":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "last_3":
      return { from: ymd(new Date(y, m - 2, 1)), to: ymd(now) };
    case "this_year":
      return { from: ymd(new Date(y, 0, 1)), to: ymd(now) };
    default:
      return { from: "", to: "" };
  }
}

export default function ReportsPage() {
  const initial = rangeFor("this_month");

  const [preset, setPreset] = useState<Preset>("this_month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = rangeFor(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const load = useCallback(async () => {
    if (!from || !to || from > to) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/reports?from=${from}&to=${to}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setReport(json.data);
    } catch (e) {
      setReport(null);
      toast.error(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const bySaleType = useMemo(() => {
    const out = {
      CUSTOMER: { label: "Sold to customers", count: 0, total: 0, profit: 0 },
      AUCTION: { label: "Sold at auction", count: 0, total: 0, profit: 0 },
    };
    for (const s of report?.sold ?? []) {
      out[s.saleType].count += 1;
      out[s.saleType].total += s.salePrice;
      out[s.saleType].profit += s.profit;
    }
    return Object.values(out);
  }, [report]);

  const s = report?.summary;
  const dateError = from && to && from > to;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          How your business did in the time you choose.
        </p>
      </div>

      {/* Period */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              className={`h-9 rounded-xl px-4 text-sm font-medium transition ${
                preset === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400"
              />
            </div>
          </div>
        )}

        {dateError && (
          <p className="mt-3 text-xs text-red-600">The “From” date must be before the “To” date.</p>
        )}
        {from && to && !dateError && (
          <p className="mt-3 text-xs text-slate-400">
            Showing {formatDate(from)} to {formatDate(to)}
          </p>
        )}
      </div>

      {!report || !s ? (
        <div className="flex h-60 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
          ) : (
            <p className="text-sm text-slate-500">No report to show.</p>
          )}
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* Headline numbers */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card
              label="Your profit"
              value={formatMoney(s.netProfit)}
              note="After shop expenses"
              valueClass={s.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}
            />
            <Card
              label="Cars sold"
              value={String(s.salesCount)}
              note={`Worth ${formatMoney(s.salesTotal)}`}
            />
            <Card
              label="Money received"
              value={formatMoney(s.netReceived)}
              note={s.refunded > 0 ? `After returning ${formatMoney(s.refunded)}` : "From customers"}
            />
            <Card
              label="Customers still owe"
              value={formatMoney(s.outstanding)}
              note="On cars sold in this time"
              valueClass={s.outstanding > 0 ? "text-amber-600" : undefined}
            />
          </div>

          {s.returnsCount > 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {s.returnsCount} sale{s.returnsCount === 1 ? " was" : "s were"} cancelled in this time and{" "}
              {formatMoney(s.returnsRefunded)} was refunded. Those cars are not counted as sold.
            </p>
          )}

          {/* Profit + shop expenses */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="How your profit is made" subtitle="Cars sold in this time">
              <div className="space-y-3">
                <Line label="Cars sold for" value={s.salesTotal} />
                <Line label="Minus: what those cars cost to buy" value={-s.carsCost} />
                <Line label="Minus: repairs and expenses on those cars" value={-s.carExpensesOnSold} />
                <div className="border-t border-slate-100 pt-3">
                  <Line label="Profit on cars" value={s.grossProfit} strong tone />
                </div>
                <Line label="Minus: shop and office expenses" value={-s.shopExpenses} />
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <Line label="Your profit" value={s.netProfit} strong tone />
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Money spent on cars you haven&apos;t sold yet is not a loss. It is counted when the car is sold.
                Money from partners or loans is never counted as profit.
              </p>
            </Panel>

            <Panel title="Where shop money went" subtitle="Shop and office expenses">
              {report.shopExpenses.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No shop expenses in this time.</p>
              ) : (
                <div className="space-y-4">
                  {report.shopExpenses.map((e) => {
                    const pct = s.shopExpenses > 0 ? Math.round((e.total / s.shopExpenses) * 100) : 0;
                    return (
                      <div key={e.title}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-slate-700">
                            {e.title}
                            <span className="ml-2 text-xs text-slate-400">
                              {e.count}×
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold text-slate-900">
                            {formatMoney(e.total)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Payment methods + sale type */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="How customers paid" subtitle="Payments in this time, after returns">
              {report.byMethod.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No payments in this time.</p>
              ) : (
                <div className="space-y-3">
                  {report.byMethod.map((m) => (
                    <Line key={m.method} label={METHOD_LABEL[m.method] ?? m.method} value={m.total} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Customers and auctions" subtitle="Cars sold in this time">
              <div className="space-y-3">
                {bySaleType.map((t) => (
                  <div key={t.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t.label}</p>
                      <p className="text-xs text-slate-500">
                        {t.count} car{t.count === 1 ? "" : "s"} · {formatMoney(t.total)}
                      </p>
                    </div>
                    <p className={`text-sm font-bold ${t.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatMoney(t.profit)}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Cars sold */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Cars sold</h2>
              <p className="mt-0.5 text-sm text-slate-500">Profit on each car</p>
            </div>

            {report.sold.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                No cars were sold in this time.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <th className="px-5 py-4">Car</th>
                      <th className="px-5 py-4">Sold on</th>
                      <th className="px-5 py-4">Total cost</th>
                      <th className="px-5 py-4">Sold for</th>
                      <th className="px-5 py-4">Profit</th>
                      <th className="px-5 py-4">Customer owes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.sold.map((c) => (
                      <tr key={c.saleId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                              <CarFront className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {c.vehicle.name} {c.vehicle.model}
                              </p>
                              <p className="text-xs text-slate-500">
                                {c.saleType === "AUCTION" ? "Auction" : "Customer"} · {c.vehicle.chassisNumber || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{formatDate(c.saleDate)}</td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-900">{formatMoney(c.cost)}</p>
                          <p className="text-xs text-slate-400">
                            Bought {formatMoney(c.purchasePrice)}
                            {c.carExpenses > 0 && ` + repairs ${formatMoney(c.carExpenses)}`}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {formatMoney(c.salePrice)}
                        </td>
                        <td className={`px-5 py-4 text-sm font-bold ${c.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatMoney(c.profit)}
                        </td>
                        <td className={`px-5 py-4 text-sm ${c.remaining > 0 ? "font-semibold text-amber-600" : "text-slate-400"}`}>
                          {c.remaining > 0 ? formatMoney(c.remaining) : "Paid"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- small parts ----------------------------- */

function Card({
  label, value, note, valueClass = "text-slate-900",
}: { label: string; value: string; note: string; valueClass?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  );
}

function Panel({
  title, subtitle, children,
}: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Line({
  label, value, strong = false, tone = false,
}: { label: string; value: number; strong?: boolean; tone?: boolean }) {
  const color = tone ? (value >= 0 ? "text-emerald-600" : "text-red-600") : "text-slate-900";
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm ${strong ? "font-semibold text-slate-800" : "text-slate-500"}`}>{label}</span>
      <span className={`text-sm ${strong ? "font-bold" : "font-semibold"} ${color}`}>
        {formatMoney(value)}
      </span>
    </div>
  );
}