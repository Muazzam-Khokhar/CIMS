import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import Admin, { type AdminRole } from "@/models/Admin";
import {
  AUTH_COOKIE_NAME,
  getAuthFromRequest,
} from "@/lib/auth";

export const ALL_ROLES: AdminRole[] = [
  "OWNER",
  "MANAGER",
  "STAFF",
];

export const MANAGER_ROLES: AdminRole[] = [
  "OWNER",
  "MANAGER",
];

export async function requireRoles(
  request: NextRequest,
  allowedRoles: readonly AdminRole[],
) {
  const auth = await getAuthFromRequest(request);

  if (!auth) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
  }

  if (!mongoose.isValidObjectId(auth.userId)) {
    const response = NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );

    response.cookies.delete(AUTH_COOKIE_NAME);

    return response;
  }
  const dbStarted = performance.now();
  await connectDB();
  const connectMs = performance.now() - dbStarted;
  const lookupStarted = performance.now();
  const admin = await Admin.findOne({
    _id: auth.userId,
    isActive: true,
  }).select("_id role");
  console.log({
    authDbConnectMs: Math.round(connectMs),
    adminLookupMs: Math.round(
      performance.now() - lookupStarted
    ),
  });
  if (!admin) {
    const response = NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
    response.cookies.delete(AUTH_COOKIE_NAME);

    return response;
  }

  if (!allowedRoles.includes(admin.role)) {
    return NextResponse.json(
      {
        success: false,
        message: "Forbidden",
      },
      { status: 403 },
    );
  }

  return {
    userId: String(admin._id),
    role: admin.role,
    name:admin.name
  };
}