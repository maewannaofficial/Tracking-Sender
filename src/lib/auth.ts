import crypto from "node:crypto";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "tracking_sender_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function hmac(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyPassword(password: string, expected = process.env.ADMIN_PASSWORD ?? "") {
  return expected.length > 0 && safeEqual(password, expected);
}

export function getAuthSecret() {
  return process.env.AUTH_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
}

export function createSessionToken(secret = getAuthSecret(), now = Date.now()) {
  if (!secret) {
    throw new Error("ADMIN_PASSWORD or AUTH_SECRET is required for sessions");
  }

  const payload = `v1.${now}`;
  return `${payload}.${hmac(payload, secret)}`;
}

export function isSessionTokenValid(
  token: string | undefined,
  secret = getAuthSecret(),
  now = Date.now(),
) {
  if (!token || !secret) {
    return false;
  }

  const [version, issuedAt, signature] = token.split(".");
  if (version !== "v1" || !issuedAt || !signature) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    return false;
  }

  const maxAgeMs = SESSION_MAX_AGE_SECONDS * 1000;
  if (issuedAtMs > now || now - issuedAtMs > maxAgeMs) {
    return false;
  }

  return safeEqual(signature, hmac(`${version}.${issuedAt}`, secret));
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return isSessionTokenValid(cookieStore.get(SESSION_COOKIE)?.value);
}

export function isRequestAuthenticated(request: NextRequest) {
  return isSessionTokenValid(request.cookies.get(SESSION_COOKIE)?.value);
}
