import { NextRequest } from "next/server";

import {
  getPartners,
  createPartner,
} from "@/controllers/financeController";

import {
  ALL_ROLES,
  MANAGER_ROLES,
  requireRoles,
} from "@/lib/authorization";

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ALL_ROLES);

  if (auth instanceof Response) return auth;

  return getPartners(request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, MANAGER_ROLES);

  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    return createPartner(body, auth);
  } catch (error) {
    console.error("Create partner request error:", error);

    return Response.json(
      { success: false, message: "Invalid request data" },
      { status: 400 },
    );
  }
}