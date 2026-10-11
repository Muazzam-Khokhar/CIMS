import { NextRequest } from "next/server";
import { logoutAdmin } from "@/controllers/authController";

export async function GET(request: NextRequest) {
  return logoutAdmin(request);
}