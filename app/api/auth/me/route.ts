import { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/controllers/authController";

export async function GET(request: NextRequest) {
  return getCurrentAdmin(request);
}