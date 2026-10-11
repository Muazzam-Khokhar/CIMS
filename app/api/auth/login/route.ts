import { NextRequest } from "next/server";
import { loginAdmin } from "@/controllers/authController";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    return loginAdmin(data);
  } catch (error) {
    console.error("Login request error:", error);

    return Response.json(
      {
        success: false,
        message: "Invalid request data",
      },
      { status: 400 },
    );
  }
}