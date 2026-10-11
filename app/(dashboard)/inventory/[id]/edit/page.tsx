"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    ImagePlus,
    Save,
    Upload,
    X,
} from "lucide-react";
import { toast } from "sonner";

type VehicleImage = {
    url: string;
    publicId: string;
};

type Vehicle = {
    _id: string;
    name: string;
    model: string;
    year: number;
    color: string;
    chassisNumber: string;
    engineNumber?: string;
    registrationNumber?: string;
    mileage?: number;
    purchaseDate?: string;
    purchasePrice?: number;
    location?: string;
    condition?: string;
    notes?: string;
    images: VehicleImage[];
    status: "AVAILABLE" | "SOLD" | "DISCARDED";
};

type FormData = {
    name: string;
    model: string;
    year: string;
    color: string;
    chassisNumber: string;
    engineNumber: string;
    registrationNumber: string;
    mileage: string;
    purchaseDate: string;
    purchasePrice: string;
    location: string;
    condition: string;
    notes: string;
};

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default function EditVehiclePage({ params }: Props) {
    const [id, setId] = useState("");
    const router = useRouter();

    const [form, setForm] = useState<FormData>({
        name: "",
        model: "",
        year: "",
        color: "",
        chassisNumber: "",
        engineNumber: "",
        registrationNumber: "",
        mileage: "",
        purchaseDate: "",
        purchasePrice: "",
        location: "",
        condition: "",
        notes: "",
    });

    const [images, setImages] = useState<VehicleImage[]>([]);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const loadVehicle = async () => {
            try {
                const { id: vehicleId } = await params;

                setId(vehicleId);

                const response = await fetch(`/api/vehicles/${vehicleId}`);
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message || "Failed to load vehicle"
                    );
                }

                const vehicle: Vehicle = result.data;

                setForm({
                    name: vehicle.name || "",
                    model: vehicle.model || "",
                    year: vehicle.year?.toString() || "",
                    color: vehicle.color || "",
                    chassisNumber: vehicle.chassisNumber || "",
                    engineNumber: vehicle.engineNumber || "",
                    registrationNumber: vehicle.registrationNumber || "",
                    mileage: vehicle.mileage?.toString() || "",
                    purchaseDate: vehicle.purchaseDate
                        ? new Date(vehicle.purchaseDate)
                            .toISOString()
                            .split("T")[0]
                        : "",
                    purchasePrice: vehicle.purchasePrice?.toString() || "",
                    location: vehicle.location || "",
                    condition: vehicle.condition || "",
                    notes: vehicle.notes || "",
                });

                setImages(vehicle.images || []);
            } catch (error) {
                console.error("Load vehicle error:", error);

                setError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load vehicle"
                );
            } finally {
                setLoading(false);
            }
        };

        loadVehicle();

    }, [params]);

    const updateField = (
        field: keyof FormData,
        value: string
    ) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));

        setError("");
        setSuccess("");

    };

    const handleAddImages = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const files = Array.from(event.target.files || []);

        if (!files.length) return;

        setSelectedImages((previous) => [
            ...previous,
            ...files,
        ]);

        setImagePreviews((previous) => [
            ...previous,
            ...files.map((file) =>
                URL.createObjectURL(file)
            ),
        ]);

        event.target.value = "";

    };

    const removeExistingImage = (publicId: string) => {
        setImages((previous) =>
            previous.filter(
                (image) => image.publicId !== publicId
            )
        );
    };

    const removeNewImage = (index: number) => {
        URL.revokeObjectURL(imagePreviews[index]);

        setSelectedImages((previous) =>
            previous.filter((_, i) => i !== index)
        );

        setImagePreviews((previous) =>
            previous.filter((_, i) => i !== index)
        );

    };

    const handleSave = async () => {
        setError("");
        setSuccess("");

        if (!form.name.trim()) {
            setError("Vehicle name is required.");
            return;
        }

        if (!form.model.trim()) {
            setError("Model is required.");
            return;
        }

        if (!/^\d{4}$/.test(form.year)) {
            setError("Enter a valid 4-digit year.");
            return;
        }

        if (!form.color.trim()) {
            setError("Color is required.");
            return;
        }

        if (!form.chassisNumber.trim()) {
            setError("Chassis number is required.");
            return;
        }

        if (form.mileage && Number(form.mileage) < 0) {
            setError("Mileage cannot be negative.");
            return;
        }

        if (
            form.purchasePrice &&
            Number(form.purchasePrice) < 0
        ) {
            setError("Purchase price cannot be negative.");
            return;
        }

        try {
            setSaving(true);

            const uploadedImages: VehicleImage[] = [];

            for (const file of selectedImages) {
                const uploadForm = new FormData();

                uploadForm.append("file", file);

                const uploadResponse = await fetch("/api/upload", {
                    method: "POST",
                    body: uploadForm,
                });

                const uploadResult =
                    await uploadResponse.json();

                if (
                    !uploadResponse.ok ||
                    !uploadResult.success
                ) {
                    throw new Error(
                        uploadResult.message ||
                        "Image upload failed"
                    );
                }

                uploadedImages.push(uploadResult.data);
            }

            const payload = {
                name: form.name.trim(),
                model: form.model.trim(),
                year: Number(form.year),
                color: form.color.trim(),
                chassisNumber: form.chassisNumber.trim(),

                engineNumber:
                    form.engineNumber.trim() || undefined,

                registrationNumber:
                    form.registrationNumber.trim() || undefined,

                mileage:
                    form.mileage.trim()
                        ? Number(form.mileage)
                        : undefined,

                purchaseDate:
                    form.purchaseDate || undefined,

                purchasePrice:
                    form.purchasePrice.trim()
                        ? Number(form.purchasePrice)
                        : undefined,

                location:
                    form.location.trim() || undefined,

                condition:
                    form.condition.trim() || undefined,

                notes:
                    form.notes.trim() || undefined,

                images: [
                    ...images,
                    ...uploadedImages,
                ],
            };

            const response = await fetch(
                `/api/vehicles/${id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    "Failed to update vehicle"
                );
            }

            toast.success("Vehicle updated successfully.");
            router.push("/inventory");

        } catch (error) {
            console.error("Update vehicle error:", error);

            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to update vehicle"
            );
        } finally {
            setSaving(false);
        }

    };

    if (loading) {
        return (
            <div className="flex min-h-[500px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
            </div>
        );
    }

    if (error && !id) {
        return (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
                <h2 className="text-lg font-semibold text-red-900">
                    Unable to load vehicle
                </h2>

                <p className="mt-2 text-sm text-red-700">
                    {error}
                </p>

                <Link
                    href="/inventory"
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to inventory
                </Link>
            </div>
        );

    }

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            {/* Header */}
            <div>
                <Link href={`/inventory/${id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
>
                <ArrowLeft className="h-4 w-4" />
                Back to vehicle
            </Link>

            <div className="mt-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Edit Vehicle
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                    Update the vehicle information and images.
                </p>
            </div>
        </div>


  {
        error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
            </div>
        )
    }

    {
        success && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
            </div>
        )
    }

    {/* Basic information */ }
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
            <h2 className="text-sm font-semibold text-slate-900">
                Basic Information
            </h2>

            <p className="mt-1 text-xs text-slate-500">
                Required vehicle information.
            </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
                label="Vehicle Name"
                required
                value={form.name}
                onChange={(value) =>
                    updateField("name", value)
                }
                placeholder="e.g. Toyota Corolla"
            />

            <Input
                label="Model"
                required
                value={form.model}
                onChange={(value) =>
                    updateField("model", value)
                }
                placeholder="e.g. GLI"
            />

            <Input
                label="Year"
                required
                type="number"
                value={form.year}
                onChange={(value) =>
                    updateField("year", value)
                }
                placeholder="e.g. 2024"
            />

            <Input
                label="Color"
                required
                value={form.color}
                onChange={(value) =>
                    updateField("color", value)
                }
                placeholder="e.g. Black"
            />

            <div className="md:col-span-2">
                <Input
                    label="Chassis Number"
                    required
                    value={form.chassisNumber}
                    onChange={(value) =>
                        updateField(
                            "chassisNumber",
                            value
                        )
                    }
                    placeholder="Enter chassis number"
                />
            </div>
        </div>
    </section>

    {/* Additional information */ }
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
            <h2 className="text-sm font-semibold text-slate-900">
                Additional Information
            </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
                label="Engine Number"
                value={form.engineNumber}
                onChange={(value) =>
                    updateField(
                        "engineNumber",
                        value
                    )
                }
                placeholder="Enter engine number"
            />

            <Input
                label="Registration Number"
                value={form.registrationNumber}
                onChange={(value) =>
                    updateField(
                        "registrationNumber",
                        value
                    )
                }
                placeholder="e.g. ABC-123"
            />

            <Input
                label="Mileage"
                type="number"
                value={form.mileage}
                onChange={(value) =>
                    updateField("mileage", value)
                }
                placeholder="e.g. 45000"
            />

            <Input
                label="Purchase Date"
                type="date"
                value={form.purchaseDate}
                onChange={(value) =>
                    updateField(
                        "purchaseDate",
                        value
                    )
                }
            />

            <Input
                label="Purchase Price"
                type="number"
                value={form.purchasePrice}
                onChange={(value) =>
                    updateField(
                        "purchasePrice",
                        value
                    )
                }
                placeholder="e.g. 4500000"
            />

            <Input
                label="Location"
                value={form.location}
                onChange={(value) =>
                    updateField("location", value)
                }
                placeholder="e.g. Lahore Showroom"
            />

            <div className="md:col-span-2">
                <Input
                    label="Condition"
                    value={form.condition}
                    onChange={(value) =>
                        updateField(
                            "condition",
                            value
                        )
                    }
                    placeholder="e.g. Excellent"
                />
            </div>
        </div>
    </section>

    {/* Images */ }
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
            <h2 className="text-sm font-semibold text-slate-900">
                Vehicle Images
            </h2>

            <p className="mt-1 text-xs text-slate-500">
                Existing images can be removed and new images can be added.
            </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <label
                htmlFor="edit-vehicle-images"
                className="group flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 text-center hover:border-sky-500 hover:bg-sky-50"
            >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <ImagePlus className="h-5 w-5" />
                </div>

                <span className="text-sm font-semibold text-slate-700">
                    Add Images
                </span>

                <span className="mt-1 text-xs text-slate-400">
                    PNG, JPG or WEBP
                </span>

                <input
                    id="edit-vehicle-images"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleAddImages}
                />
            </label>

            {images.map((image, index) => (
                <div
                    key={image.publicId}
                    className="group relative overflow-hidden rounded-xl border border-slate-200"
                >
                    <img
                        src={image.url}
                        alt={`Vehicle image ${index + 1}`}
                        className="h-[140px] w-full object-cover"
                    />

                    <button
                        type="button"
                        onClick={() =>
                            removeExistingImage(
                                image.publicId
                            )
                        }
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove image"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}

            {imagePreviews.map((preview, index) => (
                <div
                    key={`${preview}-${index}`}
                    className="relative overflow-hidden rounded-xl border border-sky-200"
                >
                    <img
                        src={preview}
                        alt={`New vehicle image ${index + 1}`}
                        className="h-[140px] w-full object-cover"
                    />

                    <button
                        type="button"
                        onClick={() =>
                            removeNewImage(index)
                        }
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove image"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <div className="absolute bottom-2 left-2 rounded-md bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white">
                        New
                    </div>
                </div>
            ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Upload className="h-3.5 w-3.5" />

            {images.length + imagePreviews.length === 0
                ? "No images selected."
                : `${images.length + imagePreviews.length} ${images.length + imagePreviews.length === 1
                    ? "image"
                    : "images"
                }`}
        </div>
    </section>

    {/* Notes */ }
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-slate-800">
            Notes
        </label>

        <textarea
            value={form.notes}
            onChange={(event) =>
                updateField(
                    "notes",
                    event.target.value
                )
            }
            rows={5}
            placeholder="Add any additional notes..."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
        />
    </section>

    {/* Footer */ }
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link
            href={`/inventory/${id}`}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
            Cancel
        </Link>

        <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
        </button>
    </div>
</div >

);
}

function Input({
    label,
    required,
    value,
    onChange,
    placeholder,
    type = "text",
}: {
    label: string;
    required?: boolean;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {label}{" "}
                {required && (
                    <span className="text-red-600">*</span>
                )}
            </label>

            <input
                type={type}
                value={value}
                onChange={(event) =>
                    onChange(event.target.value)
                }
                placeholder={placeholder}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
        </div>

    );
}
