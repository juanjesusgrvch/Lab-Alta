import { NextResponse } from "next/server";

import { getAdminAuth, getAdminCredentialDiagnostic } from "@/lib/firebase-admin";
import {
  clearRateLimit,
  getRateLimitStatus,
  recordRateLimitFailure,
} from "@/lib/server/login-rate-limit";
import { verifyTurnstileToken } from "@/lib/server/turnstile";

const identityToolkitUrl =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";
const allowDevelopmentClientFallback = process.env.NODE_ENV !== "production";

const getClientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

const getRateLimitKeys = (email: string, ipAddress: string) => [
  `ip:${ipAddress || "unknown"}`,
  `email:${email.trim().toLowerCase()}`,
];

const mapIdentityToolkitError = (message: string) => {
  switch (message) {
    case "INVALID_PASSWORD":
    case "EMAIL_NOT_FOUND":
    case "INVALID_LOGIN_CREDENTIALS":
      return "auth/invalid-credential";
    case "INVALID_EMAIL":
      return "auth/invalid-email";
    case "MISSING_PASSWORD":
      return "auth/missing-password";
    case "USER_DISABLED":
      return "auth/user-disabled";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "auth/too-many-requests";
    case "OPERATION_NOT_ALLOWED":
      return "auth/operation-not-allowed";
    default:
      return "server-auth/login-failed";
  }
};

export async function POST(request: Request) {
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();

  if (!firebaseApiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "server-auth/misconfigured",
      },
      { status: 500 },
    );
  }

  const payload = await request.json().catch(() => null);
  const email =
    typeof payload === "object" &&
    payload !== null &&
    "email" in payload &&
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
  const password =
    typeof payload === "object" &&
    payload !== null &&
    "password" in payload &&
    typeof payload.password === "string"
      ? payload.password
      : "";
  const turnstileToken =
    typeof payload === "object" &&
    payload !== null &&
    "turnstileToken" in payload &&
    typeof payload.turnstileToken === "string"
      ? payload.turnstileToken
      : "";

  if (!email) {
    return NextResponse.json(
      {
        success: false,
        error: "auth/invalid-email",
      },
      { status: 400 },
    );
  }

  if (!password) {
    return NextResponse.json(
      {
        success: false,
        error: "auth/missing-password",
      },
      { status: 400 },
    );
  }

  const clientIp = getClientIp(request);
  const rateLimitKeys = getRateLimitKeys(email, clientIp);
  const rateLimitStatus = getRateLimitStatus(rateLimitKeys);

  if (rateLimitStatus.limited) {
    return NextResponse.json(
      {
        success: false,
        error: "server-auth/rate-limited",
        retryAfterSeconds: Math.ceil(rateLimitStatus.retryAfterMs / 1000),
      },
      { status: 429 },
    );
  }

  const turnstileResult = await verifyTurnstileToken({
    token: turnstileToken,
    remoteIp: clientIp,
  });

  if (!turnstileResult.success) {
    recordRateLimitFailure(rateLimitKeys);

    return NextResponse.json(
      {
        success: false,
        error: turnstileResult.error,
        errorCodes: turnstileResult.errorCodes,
      },
      { status: turnstileResult.status },
    );
  }

  const signInResponse = await fetch(`${identityToolkitUrl}?key=${firebaseApiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!signInResponse) {
    return NextResponse.json(
      {
        success: false,
        error: "server-auth/service-unavailable",
      },
      { status: 502 },
    );
  }

  if (!signInResponse.ok) {
    const failurePayload = (await signInResponse.json().catch(() => null)) as
      | {
          error?: {
            message?: string;
          };
        }
      | null;
    const mappedError = mapIdentityToolkitError(
      failurePayload?.error?.message ?? "",
    );

    recordRateLimitFailure(rateLimitKeys);

    return NextResponse.json(
      {
        success: false,
        error: mappedError,
      },
      {
        status: mappedError === "auth/too-many-requests" ? 429 : 401,
      },
    );
  }

  const signInPayload = (await signInResponse.json()) as {
    localId?: string;
  };

  if (!signInPayload.localId) {
    recordRateLimitFailure(rateLimitKeys);

    return NextResponse.json(
      {
        success: false,
        error: "server-auth/login-failed",
      },
      { status: 500 },
    );
  }

  try {
    const customToken = await getAdminAuth().createCustomToken(signInPayload.localId, {
      login_origin: "turnstile",
    });

    clearRateLimit(rateLimitKeys);

    return NextResponse.json({
      success: true,
      customToken,
    });
  } catch (error) {
    const diagnostic = getAdminCredentialDiagnostic();

    if (allowDevelopmentClientFallback) {
      console.warn("Secure auth fallback enabled in development.", {
        error,
        diagnostic,
      });

      clearRateLimit(rateLimitKeys);

      return NextResponse.json({
        success: true,
        fallbackMode: "client-password",
      });
    }

    console.error("Secure auth misconfigured while creating custom token.", {
      error,
      diagnostic,
    });

    return NextResponse.json(
      {
        success: false,
        error: "server-auth/misconfigured",
        detail: diagnostic.message,
      },
      { status: 500 },
    );
  }
}
