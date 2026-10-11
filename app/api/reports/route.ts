import { NextRequest } from "next/server";
import { getReports } from "@/controllers/reportController";
import { MANAGER_ROLES, requireRoles } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  const auth = await requireRoles(request, MANAGER_ROLES);

  if (auth instanceof Response) {
    return auth;
  }
  const searchParams = request.nextUrl.searchParams;

  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  return getReports({
    from,
    to,
  });
}