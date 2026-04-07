import type { User } from "firebase/auth";

export type AccessLevel = "full" | "demo" | "none";

interface AllowedOperatorAccount {
  uid: string;
  email?: string;
  accessLevel: Exclude<AccessLevel, "none">;
}

export const allowedOperatorAccounts: readonly AllowedOperatorAccount[] = [
  {
    uid: "YmFkf4hqIaQsBWm1waccoIdxB7K2",
    accessLevel: "full",
  },
  {
    uid: "RTgzHx5HHiNYVlPxVGIxkXMYsK83",
    accessLevel: "full",
  },
];

const normalizeEmail = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

export const getUserAccessLevel = (
  user: User | null | undefined,
): AccessLevel => {
  if (!user) {
    return "none";
  }

  const normalizedEmail = normalizeEmail(user.email);
  const matchedAccount = allowedOperatorAccounts.find((account) => {
    if (account.uid === user.uid) {
      return true;
    }

    return Boolean(account.email && normalizeEmail(account.email) === normalizedEmail);
  });

  return matchedAccount?.accessLevel ?? "none";
};

export const canUseLiveDashboard = (user: User | null | undefined) =>
  getUserAccessLevel(user) === "full";
