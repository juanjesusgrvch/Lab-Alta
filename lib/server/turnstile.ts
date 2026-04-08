const turnstileVerifyUrl =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const verifyTurnstileToken = async ({
  token,
  remoteIp,
}: {
  token: string;
  remoteIp?: string;
}) => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secretKey) {
    return {
      success: false as const,
      error: "turnstile/misconfigured",
      status: 500,
      errorCodes: [],
    };
  }

  if (!token.trim()) {
    return {
      success: false as const,
      error: "turnstile/missing-token",
      status: 400,
      errorCodes: [],
    };
  }

  const body = new URLSearchParams();
  body.set("secret", secretKey);
  body.set("response", token.trim());

  if (remoteIp?.trim()) {
    body.set("remoteip", remoteIp.trim());
  }

  const verificationResponse = await fetch(turnstileVerifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  }).catch(() => null);

  if (!verificationResponse?.ok) {
    return {
      success: false as const,
      error: "turnstile/service-unavailable",
      status: 502,
      errorCodes: [],
    };
  }

  const verificationResult = (await verificationResponse.json()) as {
    success?: boolean;
    "error-codes"?: string[];
  };

  if (!verificationResult.success) {
    return {
      success: false as const,
      error: "turnstile/verification-failed",
      status: 400,
      errorCodes: verificationResult["error-codes"] ?? [],
    };
  }

  return {
    success: true as const,
  };
};
