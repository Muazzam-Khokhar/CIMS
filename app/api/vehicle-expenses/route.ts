import { NextRequest } from "next/server";
import {
  createVehicleExpense,
  getVehicleExpenses,
} from "@/controllers/vehicleExpenseController";
import { ALL_ROLES, MANAGER_ROLES, requireRoles } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ALL_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  const vehicleId = request.nextUrl.searchParams.get("vehicleId") || undefined;

  return getVehicleExpenses(vehicleId,request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(
    request,
    MANAGER_ROLES,
  );
  
  if (auth instanceof Response) {
    return auth;
  }
  try {
    const data = await request.json();

    return createVehicleExpense(data,auth);
  } catch (error) {
    console.error("Create vehicle expense request error:", error);

    return Response.json(
      {
        success: false,
        message: "Invalid request data",
      },
      { status: 400 }
    );
  }
}