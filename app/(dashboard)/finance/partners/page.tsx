
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react";

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

const emptyForm: PartnerForm = {
  name: "",
  phone: "",
  email: "",
  notes: "",
};

const LIMIT = 10;

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] =
    useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const loadPartners = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });

      if (search) params.set("search", search);

      const response = await fetch(`/api/partners?${params}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to load partners.",
        );
      }

      setPartners(result.data || []);
      setTotalCount(Number(result.totalCount || 0));
      setHasMore(Boolean(result.hasMore));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load partners.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  const openCreateModal = () => {
    setEditingPartner(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setForm({
      name: partner.name || "",
      phone: partner.phone || "",
      email: partner.email || "",
      notes: partner.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingPartner(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      window.alert("Please enter the partner name.");
      return;
    }

    try {
      setSaving(true);

      const url = editingPartner
        ? `/api/partners/${editingPartner._id}`
        : "/api/partners";

      const response = await fetch(url, {
        method: editingPartner ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to save partner.",
        );
      }

      setModalOpen(false);
      setEditingPartner(null);
      setForm(emptyForm);

      window.alert(
        editingPartner
          ? "Partner updated successfully."
          : "Partner added successfully.",
      );

      await loadPartners();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to save partner.",
      );
    } finally {
      setSaving(false);
    }
  };

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const updateField = (field: keyof PartnerForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Partners
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage partner details and review recorded capital contributions.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Partner
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Registered Partners
            </p>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {totalCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Partners matching the current search
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Net Capital on This Page
            </p>
            <Wallet className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatPrice(
              partners.reduce(
                (total, partner) =>
                  total +
                  (partner.financialSummary?.netCapital || 0),
                0,
              ),
            )}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Contributions less capital returns for displayed partners
          </p>
        </div>
      </div>

      {/* Search */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          applySearch();
        }}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, phone or email..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
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
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Partner Records
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
              onClick={() => void loadPartners()}
              className="mt-3 text-sm font-medium text-slate-900 underline"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
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
              Add a partner or try a different search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {[
                    "Partner",
                    "Contact",
                    "Capital Contributed",
                    "Capital Returned",
                    "Net Capital",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-xs font-semibold text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => {
                  const summary = partner.financialSummary;

                  return (
                    <tr
                      key={partner._id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {partner.name}
                        </p>
                        {partner.notes && (
                          <p className="mt-1 max-w-48 truncate text-xs text-slate-400">
                            {partner.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-700">
                          {partner.phone || "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {partner.email || ""}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {formatPrice(summary?.totalContributed || 0)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {formatPrice(summary?.capitalReturned || 0)}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatPrice(summary?.netCapital || 0)}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openEditModal(partner)}
                          title="Edit partner"
                          aria-label={`Edit ${partner.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
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

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-modal-title"
            className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="partner-modal-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {editingPartner ? "Edit Partner" : "Add Partner"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Partner details and contact information.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Partner Name *
                </label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  placeholder="Enter full name"
                  maxLength={120}
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
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
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
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    maxLength={254}
                    placeholder="Email address"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
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
                    updateField("notes", event.target.value)
                  }
                  maxLength={2000}
                  placeholder="Optional details..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
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
                className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingPartner
                    ? "Update Partner"
                    : "Save Partner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
