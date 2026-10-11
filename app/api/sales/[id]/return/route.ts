import { returnSale } from "@/controllers/saleController";

import { NextRequest } from "next/server";
import { ALL_ROLES, MANAGER_ROLES, requireRoles } from "@/lib/authorization";
import { isValidObjectId } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
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

    return returnSale(id, data,auth);
  } catch (error) {
    console.error("Update Return Sale request error:", error);

    return Response.json(
      {
        success: false,
        message: "Invalid request data",
      },
      { status: 400 },
    );
  }
}