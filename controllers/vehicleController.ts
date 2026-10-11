import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vehicle from "@/models/Vehicle";
import { isValidDate, isValidNonNegativeNumber, isValidObjectId, isValidYear } from "@/lib/validation";
import { createAuditLog } from "@/lib/audit";
import { getPaginationParams } from "@/lib/pagination";
import { Types } from "mongoose";
import VehicleExpense from "@/models/VehicleExpense";
import Sale from "@/models/Sale";
import Payment from "@/models/Payment";
type CreateVehicleData = {
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
  images?: {
    url: string;
    publicId: string;
  }[];
};
type UpdateVehicleData = {
  name?: string;
  model?: string;
  year?: number;
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
  images?: {
    url: string;
    publicId: string;
  }[];
};
type VehicleSortField =
  | "name"
  | "model"
  | "year"
  | "purchasePrice"
  | "purchaseDate"
  | "createdAt";
type SortOrder = "asc" | "desc";
type AuditActor = {
  userId: string;
  name: string;
  role: "OWNER" | "MANAGER" | "STAFF";
};
export async function getVehicles(
  searchParams: URLSearchParams,
) {
  try {
    await connectDB();

    const { page, limit, skip } =
      getPaginationParams(searchParams);

    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "ALL";

    const requestedSortBy =
      searchParams.get("sortBy") || "createdAt";

    const requestedSortOrder =
      searchParams.get("sortOrder") || "desc";

    const allowedSortFields: VehicleSortField[] = [
      "name",
      "model",
      "year",
      "purchasePrice",
      "purchaseDate",
      "createdAt",
    ];

    const sortBy: VehicleSortField =
      allowedSortFields.includes(
        requestedSortBy as VehicleSortField
      )
        ? (requestedSortBy as VehicleSortField)
        : "createdAt";

    const sortOrder: SortOrder =
      requestedSortOrder === "asc"
        ? "asc"
        : "desc";

    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
        { color: { $regex: search, $options: "i" } },
        {
          chassisNumber: {
            $regex: search,
            $options: "i",
          },
        },
        {
          registrationNumber: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (
      status === "AVAILABLE" ||
      status === "SOLD" ||
      status === "DISCARDED"
    ) {
      filter.status = status;
    }

    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    if (sortBy !== "createdAt") {
      sort.createdAt = -1;
    }

    const [vehicles, totalCount] =
      await Promise.all([
        Vehicle.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),

        Vehicle.countDocuments(filter),
      ]);

    return NextResponse.json({
      success: true,
      data: vehicles,
      page,
      limit,
      hasMore:
        skip + vehicles.length < totalCount,
      totalCount,
      sortBy,
      sortOrder,
    });
  } catch (error) {
    console.error("Get vehicles error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get vehicles",
      },
      { status: 500 }
    );
  }
}

export async function getVehicle(id: string) {
  try {
    await connectDB();
 
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Vehicle not found" },
        { status: 404 },
      );
    }
 
    const vehicleId = new Types.ObjectId(id);
 
    const [vehicle, expenseTotals, sale] = await Promise.all([
      Vehicle.findById(id).lean(),
 
      VehicleExpense.aggregate([
        { $match: { vehicleId } },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
 
      Sale.findOne({ vehicleId }).lean(),
    ]);
 
    if (!vehicle) {
      return NextResponse.json(
        { success: false, message: "Vehicle not found" },
        { status: 404 },
      );
    }
 
    const vehicleExpenses: number = expenseTotals[0]?.total ?? 0;
    const expenseCount: number = expenseTotals[0]?.count ?? 0;
    const investment = (vehicle.purchasePrice ?? 0) + vehicleExpenses;
 
    let saleSummary: {
      _id: string;
      saleType: string;
      salePrice: number;
      saleDate: Date;
      totalPaid: number;
      remaining: number;
      paymentStatus: "PAID" | "PARTIAL";
      profit: number;
    } | null = null;
 
    if (sale) {
      const paymentTotals = await Payment.aggregate([
        { $match: { saleId: sale._id } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
 
      const totalPaid: number = paymentTotals[0]?.total ?? 0;
 
      saleSummary = {
        _id: sale._id.toString(),
        saleType: sale.saleType,
        salePrice: sale.salePrice,
        saleDate: sale.saleDate,
        totalPaid,
        remaining: Math.max(0, sale.salePrice - totalPaid),
        paymentStatus: totalPaid >= sale.salePrice ? "PAID" : "PARTIAL",
        profit: sale.salePrice - investment,
      };
    }
 
    return NextResponse.json({
      success: true,
      data: vehicle,
      financials: {
        vehicleExpenses,
        expenseCount,
        investment,
        sale: saleSummary,
      },
    });
  } catch (error) {
    console.error("Get vehicle error:", error);
 
    return NextResponse.json(
      { success: false, message: "Failed to get vehicle" },
      { status: 500 },
    );
  }
}


export async function createVehicle(data: CreateVehicleData,actor: AuditActor,) {
  try {
    await connectDB();
    if (!data.name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle name is required",
        },
        { status: 400 },
      );
    }
    
    if (!data.model?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle model is required",
        },
        { status: 400 },
      );
    }
    
    if (!isValidYear(data.year)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid vehicle year",
        },
        { status: 400 },
      );
    }
    
    if (!data.color?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle color is required",
        },
        { status: 400 },
      );
    }
    
    if (!data.chassisNumber?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Chassis number is required",
        },
        { status: 400 },
      );
    }
    
    if (
      data.mileage !== undefined &&
      !isValidNonNegativeNumber(data.mileage)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Mileage must be a valid non-negative number",
        },
        { status: 400 },
      );
    }
    
    if (
      data.purchasePrice !== undefined &&
      !isValidNonNegativeNumber(data.purchasePrice)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase price must be a valid non-negative number",
        },
        { status: 400 },
      );
    }
    
    if (
      data.purchaseDate !== undefined &&
      !isValidDate(data.purchaseDate)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid purchase date",
        },
        { status: 400 },
      );
    }
    const vehicle = await Vehicle.create({
      name: data.name.trim(),
      model: data.model.trim(),
      year: data.year,
      color: data.color.trim(),
      chassisNumber: data.chassisNumber.trim(),
      engineNumber:
        data.engineNumber?.trim() || undefined,
      registrationNumber:
        data.registrationNumber?.trim() || undefined,
      mileage: data.mileage,
      purchaseDate: data.purchaseDate,
      purchasePrice: data.purchasePrice,
      location:
        data.location?.trim() || undefined,
      condition:
        data.condition?.trim() || undefined,
      notes:
        data.notes?.trim() || undefined,
      images: data.images ?? [],
    });
    await createAuditLog({
      actor,
      action: "CREATE",
      entity: "VEHICLE",
      entityId: vehicle._id.toString(),
      description: `Vehicle "${vehicle.name}" created`,
      after: {
        name: vehicle.name,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        chassisNumber: vehicle.chassisNumber,
        engineNumber: vehicle.engineNumber,
        registrationNumber: vehicle.registrationNumber,
        mileage: vehicle.mileage,
        purchaseDate: vehicle.purchaseDate,
        purchasePrice: vehicle.purchasePrice,
        location: vehicle.location,
        condition: vehicle.condition,
        notes: vehicle.notes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Vehicle created successfully",
        data: vehicle,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Create vehicle error:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A vehicle with this chassis number already exists",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create vehicle",
      },
      { status: 500 }
    );
  }
}

export async function updateVehicle(
  id: string,
  data: Record<string, unknown>,
  actor: AuditActor,
) {
  try {
    await connectDB();
    const badRequest = (message: string) =>
      NextResponse.json({ success: false, message }, { status: 400 });
    
    const updates: Record<string, unknown> = {};
    

    for (const [field, label] of [
      ["name", "Vehicle name"],
      ["model", "Vehicle model"],
      ["color", "Vehicle color"],
      ["chassisNumber", "Chassis number"],
    ] as const) {
      const value = data[field];
    
      if (value === undefined) continue;
    
      if (typeof value !== "string" || !value.trim()) {
        return badRequest(`${label} is required`);
      }
    
      updates[field] = value.trim();
    }
    

    for (const field of [
      "engineNumber",
      "registrationNumber",
      "location",
      "condition",
      "notes",
    ] as const) {
      const value = data[field];
    
      if (value === undefined) continue;
    
      if (typeof value !== "string") {
        return badRequest(`Invalid ${field}`);
      }
    
      updates[field] = value.trim() || undefined;
    }
    
    if (data.year !== undefined) {
      if (!isValidYear(data.year)) {
        return badRequest("Invalid vehicle year");
      }
    
      updates.year = data.year;
    }
    
    if (data.mileage !== undefined) {
      if (data.mileage === null) {
        updates.mileage = undefined;
      } else if (!isValidNonNegativeNumber(data.mileage)) {
        return badRequest("Mileage must be a valid non-negative number");
      } else {
        updates.mileage = data.mileage;
      }
    }
    
    if (data.purchasePrice !== undefined) {
      if (!isValidNonNegativeNumber(data.purchasePrice)) {
        return badRequest("Purchase price must be a valid non-negative number");
      }
    
      updates.purchasePrice = data.purchasePrice;
    }
    
    if (data.purchaseDate !== undefined) {
      if (typeof data.purchaseDate !== "string" || !isValidDate(data.purchaseDate)) {
        return badRequest("Invalid purchase date");
      }
    
      updates.purchaseDate = data.purchaseDate;
    }
    
    if (data.images !== undefined) {
      if (
        !Array.isArray(data.images) ||
        !data.images.every(
          (image) =>
            image &&
            typeof image.url === "string" &&
            typeof image.publicId === "string",
        )
      ) {
        return badRequest("Invalid images");
      }
    
      updates.images = data.images.map(
        ({ url, publicId }: { url: string; publicId: string }) => ({
          url,
          publicId,
        }),
      );
    }
    const existingVehicle = await Vehicle.findById(id);

    if (!existingVehicle) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle not found",
        },
        { status: 404 },
      );
    }

    const before = existingVehicle.toObject();
    
    Object.assign(existingVehicle, updates);

    const vehicle = await existingVehicle.save();

    await createAuditLog({
      actor,
      action: "UPDATE",
      entity: "VEHICLE",
      entityId: vehicle._id.toString(),
      description: `Vehicle "${vehicle.name}" updated`,
      before: {
        name: before.name,
        model: before.model,
        year: before.year,
        color: before.color,
        chassisNumber: before.chassisNumber,
        engineNumber: before.engineNumber,
        registrationNumber: before.registrationNumber,
        mileage: before.mileage,
        purchaseDate: before.purchaseDate,
        purchasePrice: before.purchasePrice,
        location: before.location,
        condition: before.condition,
        notes: before.notes,
      },
      after: {
        name: vehicle.name,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        chassisNumber: vehicle.chassisNumber,
        engineNumber: vehicle.engineNumber,
        registrationNumber: vehicle.registrationNumber,
        mileage: vehicle.mileage,
        purchaseDate: vehicle.purchaseDate,
        purchasePrice: vehicle.purchasePrice,
        location: vehicle.location,
        condition: vehicle.condition,
        notes: vehicle.notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (error: unknown) {
    console.error("Update vehicle error:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A vehicle with this chassis number already exists",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update vehicle",
      },
      { status: 500 }
    );
  }
}

export async function discardVehicle(id: string,actor: AuditActor,) {
  try {
    await connectDB();

    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle not found",
        },
        { status: 404 }
      );
    }

    if (vehicle.status !== "AVAILABLE") {
      return NextResponse.json(
        {
          success: false,
          message: "Only available vehicles can be discarded",
        },
        { status: 400 }
      );
    }
    const before = vehicle.toObject();
    vehicle.status = "DISCARDED";

    await vehicle.save();
    await createAuditLog({
      actor,
      action: "DISCARD",
      entity: "VEHICLE",
      entityId: vehicle._id.toString(),
      description: `Vehicle "${vehicle.name}" discarded`,
      before: {
        status: before.status,
      },
      after: {
        status: vehicle.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Vehicle discarded successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("Discard vehicle error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to discard vehicle",
      },
      { status: 500 }
    );
  }
}