import { NextRequest } from "next/server";
import {
  createVehicle,
  getVehicles,
} from "@/controllers/vehicleController";
import { ALL_ROLES, MANAGER_ROLES, requireRoles } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  const started = performance.now();

  const auth = await requireRoles(request, ALL_ROLES);
  const authMs = performance.now() - started;
  if (auth instanceof Response) {
    console.log("Vehicles API auth:", Math.round(authMs), "ms");
    return auth;
  }
  const controllerStarted = performance.now();
  const response = await getVehicles(request.nextUrl.searchParams);

  console.log({
    authMs: Math.round(authMs),
    controllerMs: Math.round(
      performance.now() - controllerStarted
    ),
    totalMs: Math.round(performance.now() - started),
  });

  return response;
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

    return createVehicle(data,auth);
  } catch (error: unknown) {
    console.error("Create vehicle error:", error);
    return Response.json(
      {
        success: false,
        message: "Invalid request data",
      },
      { status: 400 }
    );
  }
}