import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Types } from "mongoose";
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
import Vehicle from "@/models/Vehicle";
import VehicleExpense from "@/models/VehicleExpense";
import { createAuditLog } from "@/lib/audit";
import { getPaginationParams } from "@/lib/pagination";
import {
  isValidDate,
  isValidObjectId,
  isValidPositiveNumber,
} from "@/lib/validation";
type AuditActor = {
  userId: string;
  name: string;
  role: "OWNER" | "MANAGER" | "STAFF";
};
type CreateVehicleExpenseData = {
  vehicleId: string;
  title: string;
  amount: number;
  expenseDate: string;
  notes?: string;
};

type UpdateVehicleExpenseData = {
  title?: string;
  amount?: number;
  expenseDate?: string;
  notes?: string;
};

export async function createVehicleExpense(
  data: CreateVehicleExpenseData,
  actor: AuditActor,
) {
  try {
    await connectDB();

    const vehicle = await Vehicle.findById(data.vehicleId);

    if (!vehicle) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle not found",
        },
        { status: 404 }
      );
    }

    if (!data.title?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense title is required",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense amount must be greater than 0",
        },
        { status: 400 }
      );
    }

    if (data.expenseDate !== undefined) {
      if (!isValidDate(data.expenseDate)) {
        return NextResponse.json(
          {
            success: false,
            message: "Valid expense date is required",
          },
          { status: 400 },
        );
      }
    }

    const expense = await VehicleExpense.create({
      vehicleId: data.vehicleId,
      title: data.title.trim(),
      amount: data.amount,
      expenseDate: data.expenseDate,
      notes: data.notes?.trim() || undefined,
    });
    await createAuditLog({
      actor,
      action: "CREATE",
      entity: "VEHICLE_EXPENSE",
      entityId: expense._id.toString(),
      description: `Vehicle expense "${expense.title}" of Rs. ${expense.amount} created`,
      after: {
        vehicleId: data.vehicleId,
        title: expense.title,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        notes: expense.notes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Vehicle expense added successfully",
        data: expense,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create vehicle expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create vehicle expense",
      },
      { status: 500 }
    );
  }
}

export async function getVehicleExpenses(
  vehicleId?: string,
  searchParams?: URLSearchParams,
) {
  try {
    await connectDB();

    const { page, limit, skip } =
      getPaginationParams(
        searchParams || new URLSearchParams(),
      );

      const search = searchParams?.get("search")?.trim() || "";

      const filter: Record<string, unknown> = {};
      
      if (vehicleId) {
        filter.vehicleId = new Types.ObjectId(vehicleId);
      }
      
      if (search) {
        const regex = { $regex: escapeRegex(search), $options: "i" };
      
        const matchingVehicles = await Vehicle.find({
          $or: [
            { name: regex },
            { model: regex },
            { chassisNumber: regex },
            { registrationNumber: regex },
          ],
        })
          .select("_id")
          .lean();
      
        filter.$or = [
          { title: regex },
          { vehicleId: { $in: matchingVehicles.map((v) => v._id) } },
        ];
      }

    const [expenses, totalCount] =
      await Promise.all([
        VehicleExpense.find(filter)
          .populate({
            path: "vehicleId",
            select:
              "name model color chassisNumber registrationNumber purchasePrice status",
          })
          .sort({
            expenseDate: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        VehicleExpense.countDocuments(filter),
      ]);

    const totalAmount = await VehicleExpense.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      data: expenses,
      totalAmount: totalAmount[0]?.total || 0,
      page,
      limit,
      hasMore:
        skip + expenses.length < totalCount,
      totalCount,
    });
  } catch (error) {
    console.error(
      "Get vehicle expenses error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch vehicle expenses",
      },
      { status: 500 },
    );
  }
}

export async function getVehicleExpense(id: string) {
  try {
    await connectDB();

    const expense = await VehicleExpense.findById(id)
      .populate({
        path: "vehicleId",
        select:
          "name model color chassisNumber registrationNumber purchasePrice status",
      })
      .lean();

    if (!expense) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle expense not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error("Get vehicle expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch vehicle expense",
      },
      { status: 500 }
    );
  }
}

export async function updateVehicleExpense(
  id: string,
  data: UpdateVehicleExpenseData,
  actor: AuditActor,
) {
  try {
    await connectDB();

    const expense = await VehicleExpense.findById(id);
    if (!expense) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle expense not found",
        },
        { status: 404 }
      );
    }
    const before = expense?.toObject();

    if (data.title !== undefined) {
      if (!data.title.trim()) {
        return NextResponse.json(
          {
            success: false,
            message: "Expense title is required",
          },
          { status: 400 }
        );
      }

      expense.title = data.title.trim();
    }

    if (data.amount !== undefined) {
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Expense amount must be greater than 0",
          },
          { status: 400 }
        );
      }

      expense.amount = data.amount;
    }

    if (data.expenseDate !== undefined) {
      if (!isValidDate(data.expenseDate)) {
        return NextResponse.json(
          {
            success: false,
            message: "Valid expense date is required",
          },
          { status: 400 },
        );
      }
    
      expense.expenseDate = new Date(data.expenseDate);
    }

    if (data.notes !== undefined) {
      expense.notes = data.notes.trim() || undefined;
    }

    await expense.save();
    await createAuditLog({
      actor,
      action: "UPDATE",
      entity: "VEHICLE_EXPENSE",
      entityId: expense._id.toString(),
      description: `Vehicle expense "${expense.title}" updated`,
      before: {
        vehicleId: before.vehicleId,
        title: before.title,
        amount: before.amount,
        expenseDate: before.expenseDate,
        notes: before.notes,
      },
      after: {
        vehicleId: expense.vehicleId,
        title: expense.title,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        notes: expense.notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Vehicle expense updated successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Update vehicle expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update vehicle expense",
      },
      { status: 500 }
    );
  }
}

export async function deleteVehicleExpense(id: string,actor: AuditActor) {
  try {
    await connectDB();
    if (!isValidObjectId(id)) {
      return Response.json(
        {
          success: false,
          message: "Invalid ID",
        },
        { status: 400 },
      );
    }
    const expense = await VehicleExpense.findById(id);

    if (!expense) {
      return NextResponse.json(
        {
          success: false,
          message: "Vehicle expense not found",
        },
        { status: 404 }
      );
    }

    const before = expense.toObject();

    await VehicleExpense.findByIdAndDelete(id);
    await createAuditLog({
      actor,
      action: "DELETE",
      entity: "VEHICLE_EXPENSE",
      entityId: expense._id.toString(),
      description: `Vehicle expense "${expense.title}" of Rs. ${expense.amount} deleted`,
      before: {
        vehicleId: before.vehicleId,
        title: before.title,
        amount: before.amount,
        expenseDate: before.expenseDate,
        notes: before.notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Vehicle expense deleted successfully",
    });
  } catch (error) {
    console.error("Delete vehicle expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete vehicle expense",
      },
      { status: 500 }
    );
  }
}