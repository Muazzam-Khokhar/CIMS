import { NextRequest } from "next/server";
import { getMoneyOverview } from "@/controllers/moneyController";
import { ALL_ROLES, requireRoles } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, ALL_ROLES);
  if (auth instanceof Response) return auth;

  return getMoneyOverview();
}