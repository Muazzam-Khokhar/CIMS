"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CarFront,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { AddVehicleModal } from "@/components/addVehicleModal";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
type VehicleImage = {
  url: string;
  publicId: string;
};
type Vehicle = {
  _id: string;
  images: VehicleImage[];
  name: string;
  model?: string;
  color?: string;
  chassisNumber?: string;
  engineNumber?: string;
  registrationNumber?: string;
  mileage?: number;
  purchaseDate?: string;
  purchasePrice?: number;
  location?: string;
  condition?: string;
  notes?: string;
  status: "AVAILABLE" | "SOLD" | "DISCARDED";
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "ALL" | "AVAILABLE" | "SOLD" | "DISCARDED";
type VehicleSortField =
  | "name"
  | "model"
  | "purchasePrice"
  | "purchaseDate"
  | "createdAt";

type SortOrder = "asc" | "desc";

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] =
    useState<VehicleSortField>("purchaseDate");
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("desc");
  const [addOpen, setAddOpen] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] =
    useState<Vehicle | null>(null);
  const [sellStep, setSellStep] = useState<1 | 2>(1);
  const [saleType, setSaleType] =
    useState<"CUSTOMER" | "AUCTION">("AUCTION");
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentType, setPaymentType] =
    useState<"FULL" | "PARTIAL">("FULL");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] =
    useState<"CASH" | "BANK" | "ONLINE" | "OTHER">("CASH");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingSale, setSavingSale] = useState(false);

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      const response = await fetch(
        `/api/vehicles?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch vehicles");
      }

      const result = await response.json();

      setVehicles(result.data ?? []);
      setTotalCount(result.totalCount ?? 0);
      setHasMore(result.hasMore ?? false);
    } catch (error) {
      console.error("Failed to load vehicles:", error);

      setVehicles([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    statusFilter,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleSort = (field: VehicleSortField) => {
    setPage(1);

    if (sortBy === field) {
      setSortOrder((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortBy(field);
    setSortOrder("asc");
  };

  const getSortIcon = (field: VehicleSortField) => {
    if (sortBy !== field) {
      return null;
    }

    return sortOrder === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );
  };

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const matchesSearch =
        !query ||
        vehicle.name.toLowerCase().includes(query) ||
        vehicle.model?.toLowerCase().includes(query) ||
        vehicle.color?.toLowerCase().includes(query) ||
        vehicle.chassisNumber?.toLowerCase().includes(query) ||
        vehicle.registrationNumber
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        vehicle.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vehicles, search, statusFilter]);

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) {
      return "—";
    }

    return `¥. ${price.toLocaleString("en-JP")}`;
  };
  const formatDate = (date?: string) => {
    if(date === undefined || date === null){
      return "-";
    }
    return date.split("T")[0];
  }

  const getStatusLabel = (status: Vehicle["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "Available";
      case "SOLD":
        return "Sold";
      case "DISCARDED":
        return "Discarded";
    }
  };

  const getStatusClass = (status: Vehicle["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10";
      case "SOLD":
        return "bg-blue-50 text-blue-700 ring-1 ring-blue-600/10";
      case "DISCARDED":
        return "bg-red-50 text-red-700 ring-1 ring-red-600/10";
    }
  };
  const confirm = useConfirm();
  const handleDiscard = async (vehicle: Vehicle) => {
    const confirmed = await confirm({
      title: "Discard Car?",
      description: `Are you sure you want to discard "${vehicle.name}"?`,
      confirmText: "Delete",
    });
    if (!confirmed) return;
    
  
  
    try {
      const response = await fetch(
        `/api/vehicles/${vehicle._id}`,
        {
          method: "DELETE",
        }
      );
  
      const result = await response.json();
  
      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to discard vehicle"
        );
      }
  
      await loadVehicles();
    } catch (error) {
      console.error("Discard vehicle error:", error);
  
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to discard vehicle"
      );
    }
  };
  const openSellModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
  
    setSellStep(1);
    setSaleType("AUCTION");
    setSalePrice("");
    setSaleDate(new Date().toISOString().split("T")[0]);
  
    setPaymentType("FULL");
    setPaymentAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("CASH");
    setPaymentNotes("");
  
    setShowSellModal(true);
  };
  const handleConfirmSale = async (savePayment: boolean) => {
    if (!selectedVehicle) return;
  
    const price = Number(salePrice);
  
    if (!price || price <= 0) {
      toast.error("Please enter a valid sale price.");
      return;
    }
  
    if (!saleDate) {
      toast.error("Please select the sale date.");
      return;
    }
  
    if (savePayment) {
      if (!paymentDate) {
        toast.error("Please select the payment date.");
        return;
      }
    
      if (!paymentMethod) {
        toast.error("Please select a payment method.");
        return;
      }
    
      if (paymentType === "PARTIAL") {
        const amount = Number(paymentAmount);
    
        if (!amount || amount <= 0) {
          toast.error("Please enter the payment amount.");
          return;
        }
    
        if (amount > price) {
          toast.error(
            "Payment cannot be greater than the sale price.",
          );
          return;
        }
      }
    }
  
    try {
      setSavingSale(true);
  
      // 1. Create sale
      const salePayload: {
        vehicleId: string;
        saleType: "CUSTOMER" | "AUCTION";
        salePrice: number;
        saleDate: string;
        initialPayment?: {
          amount: number;
          paymentDate: string;
          paymentMethod:
            | "CASH"
            | "BANK"
            | "ONLINE"
            | "OTHER";
          notes?: string;
        };
      } = {
        vehicleId: selectedVehicle._id,
        saleType,
        salePrice: price,
        saleDate,
      };
      
      if (savePayment) {
        const amount =
          paymentType === "FULL"
            ? price
            : Number(paymentAmount);
      
        salePayload.initialPayment = {
          amount,
          paymentDate,
          paymentMethod,
          notes:
            paymentNotes.trim() || undefined,
        };
      }
      
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(salePayload),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to sell vehicle",
        );
      }
  
      toast.success(
        savePayment
          ? "Vehicle sold and payment saved successfully."
          : "Vehicle sold successfully. Payment can be added later."
      );
  
      setShowSellModal(false);
      setSellStep(1);
  
      // Reload vehicle details
      await loadVehicles();
    } catch (error) {
      console.error("Sell vehicle error:", error);
  
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sell vehicle"
      );
    } finally {
      setSavingSale(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Vehicle stock
            </h1>

            {totalCount > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {totalCount}
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Search, filter, sort, and manage vehicles currently in the business.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add vehicle
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_25px_rgba(15,23,42,0.035)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle, model, chassis or registration..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as StatusFilter
                  )
                }
                className="bg-transparent text-sm font-medium text-slate-700 outline-none"
              >
                <option value="ALL">All status</option>
                <option value="AVAILABLE">Available</option>
                <option value="SOLD">Sold</option>
                <option value="DISCARDED">Discarded</option>
              </select>
            </div>

            <button
              type="button"
              onClick={loadVehicles}
              disabled={loading}
              className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_25px_rgba(15,23,42,0.035)]">
        
        {loading && vehicles.length === 0 ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />

              <p className="text-sm text-slate-500">
                Loading vehicles...
              </p>
            </div>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50">
              <CarFront className="h-6 w-6 text-sky-700" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No vehicles found
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {search || statusFilter !== "ALL"
                ? "Try changing your search or status filter."
                : "Add your first vehicle to start managing your inventory."}
            </p>

            {(search || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
                className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        Vehicle
                        {/* {getSortIcon("name")} */}
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      {/* <button
                        type="button"
                        onClick={() => handleSort("model")}
                        className="group inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase transition hover:text-slate-900"
                      >
                        {getSortIcon("model")}
                      </button> */}
                        Model
                    </th>


                    <th className="px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Chassis number
                    </th>

                    
                    <th className="px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      {/* <button
                        type="button"
                        onClick={() =>
                          handleSort("purchasePrice")
                        }
                        className="group inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase transition hover:text-slate-900"
                      >
                        {getSortIcon("purchasePrice")}
                      </button> */}
                        Purchase price
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      {/* <button
                        type="button"
                        onClick={() => handleSort("purchaseDate")}
                        className="group inline-flex items-center gap-1.5 text-xs tracking-wide text-slate-500 uppercase transition hover:text-slate-900"
                      >
                        {getSortIcon("purchaseDate")}
                      </button> */}
                        Purchase Date
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr
                      key={vehicle._id}
                      className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {vehicle.name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {vehicle.color}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {vehicle.model}
                      </td>


                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-slate-600">
                          {vehicle.chassisNumber}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatPrice(vehicle.purchasePrice)}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-slate-700">
                        {formatDate(vehicle.purchaseDate)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                            vehicle.status
                          )}`}
                        >
                          {getStatusLabel(vehicle.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/inventory/${vehicle._id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-sky-50 hover:text-sky-700"
                            title="View vehicle"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {vehicle.status === "AVAILABLE" && (
                            <button
                              type="button"
                              onClick={() =>
                                openSellModal(vehicle)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                              title="Mark as sold"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}

                          {vehicle.status !== "DISCARDED" && (
                            <>
                              <Link
                                href={`/inventory/${vehicle._id}/edit`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                title="Edit vehicle"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDiscard(vehicle)
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                title="Discard vehicle"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {(page - 1) * limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-slate-700">
                    {Math.min(page * limit, totalCount)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">
                    {totalCount}
                  </span>{" "}
                  vehicles
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1 || loading}
                    onClick={() =>
                      setPage((current) => current - 1)
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="min-w-20 text-center text-xs font-semibold text-slate-600">
                    Page {page} of{" "}
                    {Math.max(
                      1,
                      Math.ceil(totalCount / limit)
                    )}
                  </span>

                  <button
                    type="button"
                    disabled={!hasMore || loading}
                    onClick={() =>
                      setPage((current) => current + 1)
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AddVehicleModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={loadVehicles}
      />
      {showSellModal && selectedVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Mark as Sold
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {selectedVehicle.name} {selectedVehicle.model} · Step{" "}
                  {sellStep} of 2
                </p>
              </div>

              <button
                type="button"
                disabled={savingSale}
                onClick={() => setShowSellModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* STEP 1 */}
            {sellStep === 1 && (
              <div className="space-y-5 p-6">

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Sale Type
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSaleType("AUCTION")}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        saleType === "AUCTION"
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      Auction
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleType("CUSTOMER")}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        saleType === "CUSTOMER"
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      Customer
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Sold Price *
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="Enter sold price"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Sold Date *
                  </label>

                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={() => setShowSellModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!salePrice || Number(salePrice) <= 0) {
                        toast.error("Please enter a valid sale price.");
                        return;
                      }

                      if (!saleDate) {
                        toast.error("Please select the sold date.");
                        return;
                      }
                      setPaymentDate(saleDate);
                      setSellStep(2);
                    }}
                    className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {sellStep === 2 && (
              <div className="space-y-5 p-6">

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Sale Type
                    </span>

                    <span className="text-sm font-semibold text-slate-900">
                      {saleType === "CUSTOMER"
                        ? "Customer"
                        : "Auction"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Sale Price
                    </span>

                    <span className="font-semibold text-slate-900">
                    ¥. {Number(salePrice).toLocaleString("en-JP")}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Payment Type
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentType("FULL")}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                        paymentType === "FULL"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      Full Payment
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentType("PARTIAL")}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                        paymentType === "PARTIAL"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      Partial Payment
                    </button>
                  </div>
                </div>

                <div
                  className={`max-h-[250px] space-y-4 overflow-y-auto rounded-xl border p-4 ${
                    paymentType === "FULL"
                      ? "border-emerald-100 bg-emerald-50/50"
                      : "border-amber-100 bg-amber-50/50"
                  }`}
                >
                  {paymentType === "PARTIAL" && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Paid Amount *
                      </label>

                      <input
                        type="number"
                        min="1"
                        max={Number(salePrice)}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Enter paid amount"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Payment Date *
                    </label>

                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Payment Method *
                    </label>

                    <select
                      value={paymentMethod}
                      onChange={(e) =>
                        setPaymentMethod(
                          e.target.value as "CASH" | "BANK" | "ONLINE" | "OTHER"
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank</option>
                      <option value="ONLINE">Online</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Notes
                    </label>

                    <textarea
                      rows={3}
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Optional notes"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>

                  {paymentType === "PARTIAL" && paymentAmount && (
                    <div className="flex justify-between border-t border-amber-200 pt-3 text-sm">
                      <span className="text-slate-600">Remaining</span>

                      <span className="font-bold text-slate-900">
                      ¥.{" "}
                        {Math.max(
                          0,
                          Number(salePrice) - Number(paymentAmount)
                        ).toLocaleString("en-JP")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    disabled={savingSale}
                    onClick={() => setSellStep(1)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Back
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={savingSale}
                      onClick={() => handleConfirmSale(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Save Later
                    </button>

                    <button
                      type="button"
                      disabled={savingSale}
                      onClick={() => handleConfirmSale(true)}
                      className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      {savingSale ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}