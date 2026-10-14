"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
import { formatMoney } from "@/lib/format";

type Partner = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  financialSummary?: {
    totalContributed: number;
    capitalReturned: number;
    netCapital: number;
  };
};

type PartnerForm = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

const emptyForm: PartnerForm = { name: "", phone: "", email: "", notes: "" };
const LIMIT = 10;

export default function PartnersPage() {
  const confirm = useConfirm();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [moneyInBusiness, setMoneyInBusiness] = useState<number | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const loadPartners = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/partners?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      const rows: Partner[] = json.data || [];
      const count = Number(json.totalCount || 0);

      if (rows.length === 0 && page > 1 && count <= (page - 1) * LIMIT) {
        setPage(Math.max(1, Math.ceil(count / LIMIT)));
        return;
      }

      setPartners(rows);
      setTotalCount(count);
      setHasMore(Boolean(json.hasMore));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load partners");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  // Total across ALL partners, not just this page
  const loadTotal = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/overview", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success) {
        setMoneyInBusiness(
          json.data.moneyIn.partnersPutIn -
            json.data.moneyOut.partnersMoneyReturned,
        );
      }
    } catch {
      /* card just stays empty */
    }
  }, []);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    void loadTotal();
  }, [loadTotal]);

  const set = (field: keyof PartnerForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name || "",
      phone: p.phone || "",
      email: p.email || "",
      notes: p.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Please enter the partner's name.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        editing ? `/api/partners/${editing._id}` : "/api/partners",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            notes: form.notes.trim(),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success(editing ? "Partner updated." : "Partner added.");
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadPartners();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save partner");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Partner) {
    const ok = await confirm({
      title: "Delete this partner?",
      description: `"${p.name}" will be removed. This only works if the partner has no money entries or loans.`,
      confirmText: "Delete",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/partners/${p._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      toast.success("Partner deleted.");
      await Promise.all([loadPartners(), loadTotal()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete partner");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Partners
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            People who put money into your business. To record money they put
            in or took out, use{" "}
            <Link href="/finance" className="font-medium text-sky-700 underline">
              Money
            </Link>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add partner
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Partners</p>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {totalCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Partners&apos; money in the business
            </p>
            <Wallet className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {moneyInBusiness === null ? "—" : formatMoney(moneyInBusiness)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Money put in, minus money given back
          </p>
        </div>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, phone or email..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          Search
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadPartners()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            All partners
          </h2>
          <p className="text-xs text-slate-500">
            {totalCount === 0
              ? "No partners"
              : `Showing ${(page - 1) * LIMIT + 1}–${Math.min(
                  page * LIMIT,
                  totalCount,
                )} of ${totalCount}`}
          </p>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
          </div>
        ) : partners.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No partners found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {search
                ? "Try a different name."
                : "Add your first partner to start recording their money."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {[
                    "Partner",
                    "Phone / Email",
                    "Money put in",
                    "Money given back",
                    "Money still in business",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-5 py-3 text-xs font-semibold text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => {
                  const s = p.financialSummary;
                  return (
                    <tr
                      key={p._id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {p.name}
                        </p>
                        {p.notes && (
                          <p className="mt-1 max-w-48 truncate text-xs text-slate-400">
                            {p.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-700">
                          {p.phone || "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {p.email || ""}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {formatMoney(s?.totalContributed || 0)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {formatMoney(s?.capitalReturned || 0)}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatMoney(s?.netCapital || 0)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            title="Edit partner"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(p)}
                            title="Delete partner"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
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

        {/* Pagination */}
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editing ? "Edit partner" : "Add partner"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Name and contact details.
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
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Name *
                </label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={120}
                  placeholder="Full name"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    maxLength={30}
                    placeholder="Phone number"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    maxLength={254}
                    placeholder="Email (optional)"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Note (optional)
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  maxLength={2000}
                  placeholder="Anything you want to remember..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
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
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editing ? "Save changes" : "Add partner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}