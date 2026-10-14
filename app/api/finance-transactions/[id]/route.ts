import { NextRequest } from "next/server";

import {
  getFinanceTransaction,
  updateFinanceTransaction,
  deleteFinanceTransaction,
} from "@/controllers/financeController";

import {
  ALL_ROLES,
  MANAGER_ROLES,
  requireRoles,
} from "@/lib/authorization";

import { isValidObjectId } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await requireRoles(request, ALL_ROLES);

  if (auth instanceof Response) return auth;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return Response.json(
      { success: false, message: "Invalid ID" },
      { status: 400 },
    );
  }

  return getFinanceTransaction(id);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await requireRoles(request, MANAGER_ROLES);

  if (auth instanceof Response) return auth;

  try {
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return Response.json(
        { success: false, message: "Invalid ID" },
        { status: 400 },
      );
    }

    const body = await request.json();

    return updateFinanceTransaction(id, body, auth);
  } catch (error) {
    console.error(
      "Update finance transaction request error:",
      error,
    );

    return Response.json(
      { success: false, message: "Invalid request data" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await requireRoles(request, MANAGER_ROLES);

  if (auth instanceof Response) return auth;

  const { id } = await context.params;

  if (!isValidObjectId(id)) {
    return Response.json(
      { success: false, message: "Invalid ID" },
      { status: 400 },
    );
  }

  return deleteFinanceTransaction(id, auth);
}