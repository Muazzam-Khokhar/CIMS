import { NextRequest } from "next/server";
import { updatePayment, deletePayment } from "@/controllers/paymentController";
import { ALL_ROLES, MANAGER_ROLES, requireRoles } from "@/lib/authorization";
import { isValidObjectId } from "@/lib/validation";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireRoles(
    request,
    MANAGER_ROLES,
  );

  if (auth instanceof Response) {
    return auth;
  }
  try {
    const { id } = await params;
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

    return updatePayment(id, data,auth);
  } catch {
    return Response.json(
      {
        success: false,
        message: "Invalid request data",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireRoles(
    _request,
    MANAGER_ROLES,
  );

  if (auth instanceof Response) {
    return auth;
  }
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return Response.json(
      {
        success: false,
        message: "Invalid ID",
      },
      { status: 400 },
    );
  }

  return deletePayment(id,auth);
}