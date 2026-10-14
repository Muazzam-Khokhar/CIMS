import { NextRequest } from "next/server";

import {
  getPartner,
  updatePartner,
  deletePartner,
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

  return getPartner(id);
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
    return updatePartner(id, body, auth);
  } catch (error) {
    console.error("Update partner request error:", error);

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

  return deletePartner(id, auth);
}