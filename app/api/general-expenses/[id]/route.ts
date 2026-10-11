import { NextRequest } from "next/server";
import {
  deleteGeneralExpense,
  getGeneralExpense,
  updateGeneralExpense,
} from "@/controllers/generalExpenseController";
import { ALL_ROLES, MANAGER_ROLES, requireRoles } from "@/lib/authorization";
import { isValidObjectId } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const auth = await requireRoles(_request, ALL_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return Response.json(
      {
        success: false,
        message: "Invalid ID",
      },
      { status: 400 },
    );
  }
  return getGeneralExpense(id);
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await requireRoles(request, MANAGER_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  try {
    const { id } = await context.params;
    if (!isValidObjectId(id)) {
      return Response.json(
        {
          success: false,
          message: "Invalid ID",
        },
        { status: 400 },
      );
    }
    const data = await request.json();

    return updateGeneralExpense(id, data,auth);
  } catch (error) {
    console.error("Update general expense request error:", error);

    return Response.json(
      {
        success: false,
        message: "Invalid request data",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const auth = await requireRoles(_request, MANAGER_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  const { id } = await context.params;
  if (!isValidObjectId(id)) {
    return Response.json(
      {
        success: false,
        message: "Invalid ID",
      },
      { status: 400 },
    );
  }

  return deleteGeneralExpense(id,auth);
}