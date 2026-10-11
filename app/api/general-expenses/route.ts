import { NextRequest } from "next/server";
import {
  createGeneralExpense,
  getGeneralExpenses,
} from "@/controllers/generalExpenseController";
import { ALL_ROLES, MANAGER_ROLES, requireRoles } from "@/lib/authorization";

export async function GET(request:NextRequest) {
  const auth = await requireRoles(request, ALL_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  return getGeneralExpenses(request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, MANAGER_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  try {
    const data = await request.json();
    return createGeneralExpense(data,auth);
  } catch (error) {
    console.error("Create general expense request error:", error);

    return Response.json(
      {
        success: false,
        message: "Invalid request data",
      },
      { status: 400 },
    );
  }
}