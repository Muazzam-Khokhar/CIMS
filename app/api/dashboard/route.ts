import { getDashboard } from "@/controllers/dashboardController";
import { ALL_ROLES, requireRoles } from "@/lib/authorization";
import { NextRequest } from "next/server";

export async function GET(request:NextRequest) {
  const auth = await requireRoles(request, ALL_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  return getDashboard();
}