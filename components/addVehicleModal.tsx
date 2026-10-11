"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Upload, X } from "lucide-react";
import { toast } from "sonner";

type AddVehicleModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type VehicleForm = {
  name: string;
  model: string;
  year: string;
  color: string;
  chassisNumber: string;
  purchasePrice: string;
  purchaseDate: string;

  engineNumber: string;
  registrationNumber: string;
  mileage: string;
  location: string;
  condition: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof VehicleForm, string>>;

type UploadedImage = {
  url: string;
  publicId: string;
};

const BASIC_FIELDS: (keyof VehicleForm)[] = [
  "name",
  "model",
  "year",
  "color",
  "chassisNumber",
  "purchasePrice",
  "purchaseDate",
];

const ADDITIONAL_FIELDS: (keyof VehicleForm)[] = [
  "engineNumber",
  "registrationNumber",
  "mileage",
  "location",
  "condition",
  "notes",
];

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const emptyForm: VehicleForm = {
  name: "",
  model: "",
  year: "",
  color: "",
  chassisNumber: "",
  purchasePrice: "",
  purchaseDate: "",

  engineNumber: "",
  registrationNumber: "",
  mileage: "",
  location: "",
  condition: "",
  notes: "",
};

// Local date (not UTC), so it is correct early in the morning too.
function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset).toISOString().split("T")[0];
}

function inputClass(hasError: boolean) {
  return `h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#334155] outline-none transition placeholder:text-[#94A3B8] ${
    hasError
      ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10"
      : "border-[#CBD5E1] focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10"
  }`;
}

async function uploadImage(file: File): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || `Failed to upload ${file.name}`);
  }

  return result.data;
}

function Field({
  id,
  label,
  required,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold text-[#334155]"
      >
        {label}
        {required && <span className="text-[#DC2626]"> *</span>}
      </label>

      {children}

      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-[#DC2626]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function AddVehicleModal({
  open,
  onClose,
  onSuccess,
}: AddVehicleModalProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "additional">("basic");

  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState("Saving...");
  const [serverError, setServerError] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const previewsRef = useRef<string[]>([]);

  useEffect(() => {
    previewsRef.current = imagePreviews;
  }, [imagePreviews]);

  // Reset everything when the modal closes (and free image previews)
  useEffect(() => {
    if (!open) {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));

      setForm(emptyForm);
      setErrors({});
      setServerError("");
      setActiveTab("basic");
      setSelectedImages([]);
      setImagePreviews([]);
    }
  }, [open]);

  // Free previews if the component unmounts while open
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Close with Escape (not while saving)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  const updateField = useCallback(
    (field: keyof VehicleForm, value: string) => {
      setForm((previous) => ({ ...previous, [field]: value }));
      setErrors((previous) => ({ ...previous, [field]: "" }));
      setServerError("");
    },
    []
  );

  if (!open) {
    return null;
  }

  const today = getToday();
  const basicHasError = BASIC_FIELDS.some((field) => Boolean(errors[field]));
  const additionalHasError = ADDITIONAL_FIELDS.some((field) =>
    Boolean(errors[field])
  );

  const validateForm = () => {
    const newErrors: FormErrors = {};
    const maxYear = new Date().getFullYear() + 1;

    if (!form.name.trim()) {
      newErrors.name = "Vehicle name is required";
    }

    if (!form.model.trim()) {
      newErrors.model = "Model is required";
    }

    if (!form.year.trim()) {
      newErrors.year = "Year is required";
    } else {
      const year = Number(form.year);

      if (!/^\d{4}$/.test(form.year) || year < 1900 || year > maxYear) {
        newErrors.year = `Enter a valid year between 1900 and ${maxYear}`;
      }
    }

    if (!form.color.trim()) {
      newErrors.color = "Color is required";
    }

    if (!form.chassisNumber.trim()) {
      newErrors.chassisNumber = "Chassis number is required";
    }

    if (!form.purchasePrice.trim()) {
      newErrors.purchasePrice = "Purchase price is required";
    } else if (
      !Number.isFinite(Number(form.purchasePrice)) ||
      Number(form.purchasePrice) < 0
    ) {
      newErrors.purchasePrice = "Enter a valid price (0 or more)";
    }

    if (form.purchaseDate && form.purchaseDate > today) {
      newErrors.purchaseDate = "Purchase date cannot be in the future";
    }

    if (
      form.mileage.trim() &&
      (!Number.isFinite(Number(form.mileage)) || Number(form.mileage) < 0)
    ) {
      newErrors.mileage = "Enter a valid mileage (0 or more)";
    }

    setErrors(newErrors);

    const hasBasicError = BASIC_FIELDS.some((field) => newErrors[field]);
    const hasAdditionalError = ADDITIONAL_FIELDS.some(
      (field) => newErrors[field]
    );

    if (hasBasicError) {
      setActiveTab("basic");
      return false;
    }

    if (hasAdditionalError) {
      setActiveTab("additional");
      return false;
    }

    return true;
  };

  const handleAddImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Allow selecting the same file again
    event.target.value = "";

    if (!files.length) return;

    const valid: File[] = [];

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only PNG, JPG or WEBP images are allowed.`);
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`${file.name} is larger than 5 MB.`);
        continue;
      }

      valid.push(file);
    }

    const room = Math.max(0, MAX_IMAGES - selectedImages.length);

    if (valid.length > room) {
      toast.error(`You can add up to ${MAX_IMAGES} images per vehicle.`);
    }

    const accepted = valid.slice(0, room);

    if (!accepted.length) return;

    setSelectedImages((previous) => [...previous, ...accepted]);
    setImagePreviews((previous) => [
      ...previous,
      ...accepted.map((file) => URL.createObjectURL(file)),
    ]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);

    setSelectedImages((previous) => previous.filter((_, i) => i !== index));
    setImagePreviews((previous) => previous.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (saving) return;

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setServerError("");

      let uploadedImages: UploadedImage[] = [];

      if (selectedImages.length > 0) {
        setSaveStep(
          `Uploading ${selectedImages.length} image${
            selectedImages.length === 1 ? "" : "s"
          }...`
        );

        uploadedImages = await Promise.all(selectedImages.map(uploadImage));
      }

      setSaveStep("Saving vehicle...");

      const payload = {
        name: form.name.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        color: form.color.trim(),
        chassisNumber: form.chassisNumber.trim(),
        purchasePrice: Number(form.purchasePrice),
        purchaseDate: form.purchaseDate || today,

        ...(form.engineNumber.trim() && {
          engineNumber: form.engineNumber.trim(),
        }),

        ...(form.registrationNumber.trim() && {
          registrationNumber: form.registrationNumber.trim(),
        }),

        ...(form.mileage.trim() && {
          mileage: Number(form.mileage),
        }),

        ...(form.location.trim() && {
          location: form.location.trim(),
        }),

        ...(form.condition.trim() && {
          condition: form.condition.trim(),
        }),

        ...(form.notes.trim() && {
          notes: form.notes.trim(),
        }),

        images: uploadedImages,
      };

      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create vehicle");
      }

      toast.success("Vehicle added successfully.");

      onClose();
      onSuccess();
    } catch (error) {
      console.error("Create vehicle error:", error);

      const message =
        error instanceof Error ? error.message : "Failed to create vehicle";

      if (/chassis/i.test(message)) {
        // e.g. "A vehicle with this chassis number already exists"
        setErrors((previous) => ({ ...previous, chassisNumber: message }));
        setActiveTab("basic");
      } else {
        setServerError(message);
        contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-vehicle-title"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2
              id="add-vehicle-title"
              className="text-lg font-semibold text-[#0F172A]"
            >
              Add Vehicle
            </h2>

            <p className="mt-0.5 text-xs text-[#64748B]">
              Add a new vehicle to your inventory
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#334155] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E2E8F0] px-6">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === "basic"
                ? "border-[#1D4ED8] text-[#1D4ED8]"
                : "border-transparent text-[#64748B] hover:text-[#334155]"
            }`}
          >
            Basic Information
            {basicHasError && (
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("additional")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === "additional"
                ? "border-[#1D4ED8] text-[#1D4ED8]"
                : "border-transparent text-[#64748B] hover:text-[#334155]"
            }`}
          >
            Additional Information
            {additionalHasError && (
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
            )}
          </button>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5">
          {serverError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1">{serverError}</p>
            </div>
          )}

          {/* BASIC TAB */}
          {activeTab === "basic" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">
                  Vehicle Details
                </h3>

                <p className="mt-1 text-xs text-[#64748B]">
                  These fields are required to add a vehicle.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  id="vehicle-name"
                  label="Vehicle Name"
                  required
                  error={errors.name}
                >
                  <input
                    id="vehicle-name"
                    type="text"
                    autoFocus
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="e.g. Toyota Corolla"
                    aria-invalid={Boolean(errors.name)}
                    className={inputClass(Boolean(errors.name))}
                  />
                </Field>

                <Field
                  id="vehicle-model"
                  label="Model"
                  required
                  error={errors.model}
                >
                  <input
                    id="vehicle-model"
                    type="text"
                    value={form.model}
                    onChange={(e) => updateField("model", e.target.value)}
                    placeholder="e.g. GLI"
                    aria-invalid={Boolean(errors.model)}
                    className={inputClass(Boolean(errors.model))}
                  />
                </Field>

                <Field
                  id="vehicle-year"
                  label="Year"
                  required
                  error={errors.year}
                >
                  <input
                    id="vehicle-year"
                    type="number"
                    value={form.year}
                    onChange={(e) => updateField("year", e.target.value)}
                    placeholder="e.g. 2024"
                    aria-invalid={Boolean(errors.year)}
                    className={inputClass(Boolean(errors.year))}
                  />
                </Field>

                <Field
                  id="vehicle-color"
                  label="Color"
                  required
                  error={errors.color}
                >
                  <input
                    id="vehicle-color"
                    type="text"
                    value={form.color}
                    onChange={(e) => updateField("color", e.target.value)}
                    placeholder="e.g. Black"
                    aria-invalid={Boolean(errors.color)}
                    className={inputClass(Boolean(errors.color))}
                  />
                </Field>

                <Field
                  id="vehicle-chassis"
                  label="Chassis Number"
                  required
                  error={errors.chassisNumber}
                >
                  <input
                    id="vehicle-chassis"
                    type="text"
                    value={form.chassisNumber}
                    onChange={(e) =>
                      updateField("chassisNumber", e.target.value)
                    }
                    placeholder="Enter chassis number"
                    aria-invalid={Boolean(errors.chassisNumber)}
                    className={inputClass(Boolean(errors.chassisNumber))}
                  />
                </Field>

                <Field
                  id="vehicle-price"
                  label="Purchase Price"
                  required
                  error={errors.purchasePrice}
                >
                  <input
                    id="vehicle-price"
                    type="number"
                    min="0"
                    value={form.purchasePrice}
                    onChange={(e) =>
                      updateField("purchasePrice", e.target.value)
                    }
                    placeholder="e.g. 4500000"
                    aria-invalid={Boolean(errors.purchasePrice)}
                    className={inputClass(Boolean(errors.purchasePrice))}
                  />
                </Field>

                <Field
                  id="vehicle-purchase-date"
                  label="Purchase Date"
                  error={errors.purchaseDate}
                >
                  <input
                    id="vehicle-purchase-date"
                    type="date"
                    max={today}
                    value={form.purchaseDate}
                    onChange={(e) =>
                      updateField("purchaseDate", e.target.value)
                    }
                    aria-invalid={Boolean(errors.purchaseDate)}
                    className={inputClass(Boolean(errors.purchaseDate))}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ADDITIONAL TAB */}
          {activeTab === "additional" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">
                  Additional Information
                </h3>

                <p className="mt-1 text-xs text-[#64748B]">
                  These fields are optional. You can add them now or leave them
                  empty.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field id="vehicle-engine" label="Engine Number">
                  <input
                    id="vehicle-engine"
                    type="text"
                    value={form.engineNumber}
                    onChange={(e) =>
                      updateField("engineNumber", e.target.value)
                    }
                    placeholder="Enter engine number"
                    className={inputClass(false)}
                  />
                </Field>

                <Field id="vehicle-registration" label="Registration Number">
                  <input
                    id="vehicle-registration"
                    type="text"
                    value={form.registrationNumber}
                    onChange={(e) =>
                      updateField("registrationNumber", e.target.value)
                    }
                    placeholder="e.g. ABC-123"
                    className={inputClass(false)}
                  />
                </Field>

                <Field
                  id="vehicle-mileage"
                  label="Mileage"
                  error={errors.mileage}
                >
                  <input
                    id="vehicle-mileage"
                    type="number"
                    min="0"
                    value={form.mileage}
                    onChange={(e) => updateField("mileage", e.target.value)}
                    placeholder="e.g. 45000"
                    aria-invalid={Boolean(errors.mileage)}
                    className={inputClass(Boolean(errors.mileage))}
                  />
                </Field>

                <Field id="vehicle-location" label="Location">
                  <input
                    id="vehicle-location"
                    type="text"
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder="e.g. Lahore Showroom"
                    className={inputClass(false)}
                  />
                </Field>

                <Field
                  id="vehicle-condition"
                  label="Condition"
                  className="md:col-span-2"
                >
                  <input
                    id="vehicle-condition"
                    type="text"
                    value={form.condition}
                    onChange={(e) => updateField("condition", e.target.value)}
                    placeholder="e.g. Excellent, Good, Needs Repair"
                    className={inputClass(false)}
                  />
                </Field>

                {/* Images */}
                <div className="md:col-span-2">
                  <div className="mb-2">
                    <label className="block text-xs font-semibold text-[#334155]">
                      Vehicle Images
                    </label>

                    <p className="mt-1 text-xs text-[#64748B]">
                      Add clear photos of the vehicle. Up to {MAX_IMAGES}{" "}
                      images, 5 MB each.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {/* Upload card */}
                      {imagePreviews.length < MAX_IMAGES && (
                        <label
                          htmlFor="vehicle-images"
                          className="group flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CBD5E1] bg-white px-3 py-4 text-center transition hover:border-[#1D4ED8] hover:bg-[#EFF6FF]"
                        >
                          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF] text-[#1D4ED8] transition group-hover:bg-[#DBEAFE]">
                            <ImagePlus className="h-5 w-5" />
                          </div>

                          <span className="text-sm font-semibold text-[#334155]">
                            Add Images
                          </span>

                          <span className="mt-1 text-xs text-[#64748B]">
                            PNG, JPG or WEBP
                          </span>

                          <input
                            id="vehicle-images"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            multiple
                            className="hidden"
                            onChange={handleAddImages}
                          />
                        </label>
                      )}

                      {/* Previews */}
                      {imagePreviews.map((preview, index) => (
                        <div
                          key={preview}
                          className="group relative min-h-[140px] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preview}
                            alt={`Vehicle image ${index + 1}`}
                            className="h-[140px] w-full object-cover"
                          />

                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

                          <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                            Image {index + 1}
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove image ${index + 1}`}
                            onClick={() => removeImage(index)}
                            disabled={saving}
                            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#475569] shadow-sm transition hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-[#64748B]">
                      <Upload className="h-3.5 w-3.5" />

                      {imagePreviews.length === 0 ? (
                        <span>
                          Click{" "}
                          <span className="font-medium text-[#334155]">
                            Add Images
                          </span>{" "}
                          to upload vehicle photos.
                        </span>
                      ) : (
                        <span>
                          {imagePreviews.length}{" "}
                          {imagePreviews.length === 1 ? "image" : "images"}{" "}
                          selected.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <Field
                  id="vehicle-notes"
                  label="Notes"
                  className="md:col-span-2"
                >
                  <textarea
                    id="vehicle-notes"
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="Add any additional notes..."
                    rows={4}
                    className="w-full resize-none rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10"
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E2E8F0] px-6 py-4">
          <p className="text-xs text-[#64748B]">
            <span className="text-[#DC2626]">*</span> Required fields
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-4 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-lg bg-[#1D4ED8] px-5 text-sm font-semibold text-white transition hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? saveStep : "Save Vehicle"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}