import type { User } from "firebase/auth";

// Tipos
export type AccessLevel = "full" | "demo" | "none";

interface AllowedOperatorAccount {
  uid: string;
  email?: string;
  accessLevel: Exclude<AccessLevel, "none">;
}

// Cuentas
export const allowedOperatorAccounts: readonly AllowedOperatorAccount[] = [
  {
    uid: "YmFkf4hqIaQsBWm1waccoIdxB7K2",
    accessLevel: "full",
  },
  {
    uid: "LK8mavuONkTbURB6dMTUHc9XAcs1",
    accessLevel: "full",
  },
];

const normalizeEmail = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

const isGoogleSession = (signInProvider?: string | null) =>
  signInProvider === "google.com";

// Acceso
export const getUserAccessLevel = (
  user: User | null | undefined,
  signInProvider?: string | null,
): AccessLevel => {
  if (!user) {
    return "none";
  }

  if (isGoogleSession(signInProvider)) {
    return "demo";
  }

  const normalizedEmail = normalizeEmail(user.email);
  const matchedAccount = allowedOperatorAccounts.find((account) => {
    if (account.uid === user.uid) {
      return true;
    }

    return Boolean(
      account.email && normalizeEmail(account.email) === normalizedEmail,
    );
  });

  return matchedAccount?.accessLevel ?? "none";
};

export const canUseLiveDashboard = (
  user: User | null | undefined,
  signInProvider?: string | null,
) => getUserAccessLevel(user, signInProvider) === "full";
