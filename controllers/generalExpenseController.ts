import { NextResponse } from "next/server";
import GeneralExpense from "@/models/GeneralExpense";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import {
  isValidDate,
  isValidObjectId,
  isValidPositiveNumber,
} from "@/lib/validation";
import { getPaginationParams } from "@/lib/pagination";
type AuditActor = {
  userId: string;
  name: string;
  role: "OWNER" | "MANAGER" | "STAFF";
};

export async function createGeneralExpense(data: {
  title: string;
  amount: number;
  expenseDate: string;
  notes?: string;
},actor: AuditActor,) {
  try {
    await connectDB();

    const title = data.title?.trim();

    if (!title) {
      return NextResponse.json(
        { success: false, message: "Expense title is required" },
        { status: 400 },
      );
    }

    if (!isValidPositiveNumber(data.amount)) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense amount must be greater than 0",
        },
        { status: 400 },
      );
    }
    
    if (!isValidDate(data.expenseDate)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid expense date is required",
        },
        { status: 400 },
      );
    }

    const expense = await GeneralExpense.create({
      title,
      amount: Number(data.amount),
      expenseDate: new Date(data.expenseDate),
      notes: data.notes?.trim() || undefined,
    });
    await createAuditLog({
      actor,
      action: "CREATE",
      entity: "GENERAL_EXPENSE",
      entityId: expense._id.toString(),
      description: `General expense "${expense.title}" created`,
      after: {
        title: expense.title,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        notes: expense.notes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "General expense added successfully",
        data: expense,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create general expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create general expense",
      },
      { status: 500 },
    );
  }
}

export async function getGeneralExpenses(
  searchParams:URLSearchParams
) {
  try {
    await connectDB();
    const { page, limit, skip } = getPaginationParams(searchParams);

    const search = (searchParams.get("search") || "").trim();
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const filter = search
      ? {
          $or: [
            { title: { $regex: escapedSearch, $options: "i" } },
            { notes: { $regex: escapedSearch, $options: "i" } },
          ],
        }
      : {};

    const [expenses, totalCount] = await Promise.all([
      GeneralExpense.find(filter)
        .sort({
          expenseDate: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      GeneralExpense.countDocuments(filter),
    ]);

    const totalAmountResult = await GeneralExpense.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);
    
    const totalAmount = totalAmountResult[0]?.total || 0;

    return NextResponse.json({
      success: true,
      data: expenses,
      page,
      limit,
      totalCount,
      hasMore: skip + expenses.length < totalCount,
      totalAmount,
    });
  } catch (error) {
    console.error("Get general expenses error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch general expenses",
      },
      { status: 500 },
    );
  }
}

export async function getGeneralExpense(id: string) {
  try {
    await connectDB();
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ID",
        },
        { status: 400 },
      );
    }
    const expense = await GeneralExpense.findById(id);

    if (!expense) {
      return NextResponse.json(
        { success: false, message: "Expense not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error("Get general expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch expense",
      },
      { status: 500 },
    );
  }
}

export async function updateGeneralExpense(
  id: string,
  data: {
    title?: string;
    amount?: number;
    expenseDate?: string;
    notes?: string;
  },
  actor: AuditActor,
) {
  try {
    await connectDB();
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ID",
        },
        { status: 400 },
      );
    }
    const expense = await GeneralExpense.findById(id);
    const before = expense?.toObject();

    if (!expense) {
      return NextResponse.json(
        { success: false, message: "Expense not found" },
        { status: 404 },
      );
    }

    if (data.title !== undefined) {
      const title = data.title.trim();

      if (!title) {
        return NextResponse.json(
          { success: false, message: "Expense title is required" },
          { status: 400 },
        );
      }

      expense.title = title;
    }

    if (data.amount !== undefined) {
      if (!isValidPositiveNumber(data.amount)) {
        return NextResponse.json(
          {
            success: false,
            message: "Expense amount must be greater than 0",
          },
          { status: 400 },
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
      entity: "GENERAL_EXPENSE",
      entityId: expense._id.toString(),
      description: `General expense "${expense.title}" updated`,
      before: {
        title: before?.title,
        amount: before?.amount,
        expenseDate: before?.expenseDate,
        notes: before?.notes,
      },
      after: {
        title: expense.title,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        notes: expense.notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: "General expense updated successfully",
      data: expense,
    });
  } catch (error) {
    console.error("Update general expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update expense",
      },
      { status: 500 },
    );
  }
}

export async function deleteGeneralExpense(id: string,actor: AuditActor) {
  try {
    await connectDB();
    const expense = await GeneralExpense.findById(id);

    if (!expense) {
      return NextResponse.json(
        {
          success: false,
          message: "Expense not found",
        },
        { status: 404 },
      );
    }

    const before = expense.toObject();

    await GeneralExpense.findByIdAndDelete(id);

    await createAuditLog({
      actor,
      action: "DELETE",
      entity: "GENERAL_EXPENSE",
      entityId: id,
      description: `General expense "${expense?.title}" deleted`,
      before: {
        title: before.title,
        amount: before.amount,
        expenseDate: before.expenseDate,
        notes: before.notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: "General expense deleted successfully",
    });
  } catch (error) {
    console.error("Delete general expense error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete expense",
      },
      { status: 500 },
    );
  }
}