import { NextRequest } from "next/server";
import { createSale, getSales } from "@/controllers/saleController";
import { ALL_ROLES, MANAGER_ROLES, requireRoles } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ALL_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  return getSales(request.nextUrl.searchParams);
}
export async function POST(request: NextRequest) {
  const auth = await requireRoles(request, MANAGER_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  try {
    const data = await request.json();

    return createSale(data,auth);
  } catch (error) {
    console.error("Create sale request error:", error);

    return Response.json(
      {
        success: false,
        message: "Invalid request data",
      },
      { status: 400 },
    );
  }
}
