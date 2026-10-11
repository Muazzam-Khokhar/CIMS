import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";

export const AUTH_COOKIE_NAME = "cims_session";

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "AUTH_SECRET is missing from environment variables",
    );
  }

  return new TextEncoder().encode(secret);
};

export type AuthPayload = {
  userId: string;
  email: string;
  role: "OWNER" | "MANAGER" | "STAFF";
};

export async function createAuthToken(
  payload: AuthPayload,
) {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyAuthToken(
  token: string,
): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      getSecret(),
    );

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      !["OWNER", "MANAGER", "STAFF"].includes(
        String(payload.role),
      )
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role as AuthPayload["role"],
    };
  } catch {
    return null;
  }
}

export async function getAuthFromRequest(
  request: NextRequest,
) {
  const token = request.cookies.get(
    AUTH_COOKIE_NAME,
  )?.value;

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}