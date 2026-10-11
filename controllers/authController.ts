import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";
import { createAuditLog } from "@/lib/audit";


import {
  AUTH_COOKIE_NAME,
  createAuthToken,
  getAuthFromRequest,
} from "@/lib/auth";

export async function loginAdmin(data: {
  email: string;
  password: string;
}) {
  try {
    await connectDB();

    const email = data.email?.trim().toLowerCase();
    const password = data.password;

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required",
        },
        { status: 400 },
      );
    }

    const admin = await Admin.findOne({
      email,
      isActive: true,
    });

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 },
      );
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        admin.passwordHash,
      );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 },
      );
    }

    const token = await createAuthToken({
      userId: String(admin._id),
      email: admin.email,
      role: admin.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      data: {
        admin: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    await createAuditLog({
      actor: {
        userId: admin._id.toString(),
        name: admin.name,
        role: admin.role,
      },
      action: "LOGIN",
      entity: "AUTH",
      entityId: admin._id.toString(),
      description: `Admin "${admin.name}" logged in`,
      after: {
        email: admin.email,
        role: admin.role,
      },
    });
    return response;
  } catch (error) {
    console.error("Admin login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to login",
      },
      { status: 500 },
    );
  }
}

export async function getCurrentAdmin(
  request: NextRequest,
) {
  try {
    await connectDB();

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

    const admin = await Admin.findOne({
      _id: auth.userId,
      isActive: true,
    }).select(
      "_id name email role isActive createdAt updatedAt",
    );

    if (!admin) {
      const response = NextResponse.json(
        {
          success: false,
          message: "Admin account not found",
        },
        { status: 401 },
      );

      response.cookies.delete(AUTH_COOKIE_NAME);

      return response;
    }

    return NextResponse.json({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error(
      "Get current admin error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load admin",
      },
      { status: 500 },
    );
  }
}

export async function logoutAdmin(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.delete(AUTH_COOKIE_NAME);

    if (auth) {
      await connectDB();

      const admin = await Admin.findById(auth.userId)
        .select("name email role")
        .lean();

      if (admin) {
        await createAuditLog({
          actor: {
            userId: admin._id.toString(),
            name: admin.name,
            role: admin.role,
          },
          action: "LOGOUT",
          entity: "AUTH",
          entityId: admin._id.toString(),
          description: `Admin "${admin.name}" logged out`,
          before: {
            email: admin.email,
            role: admin.role,
          },
        });
      }
    }

    return response;
  } catch (error) {
    console.error("Admin logout error:", error);

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.delete(AUTH_COOKIE_NAME);

    return response;
  }
}