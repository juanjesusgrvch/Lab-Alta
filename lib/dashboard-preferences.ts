import {
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { firestoreCollections, getFirebaseDb } from "@/lib/firebase";
import type {
  DashboardCampaign,
  DashboardPreferences,
} from "@/types/domain";

const STORAGE_PREFIX = "lab-alta-dashboard-preferences";

const normalizeCampaign = (
  campaign: Partial<DashboardCampaign> | null | undefined,
): DashboardCampaign | null => {
  const id = campaign?.id?.trim() ?? "";

  if (!id) {
    return null;
  }

  return {
    id,
    name: campaign?.name?.trim() ?? "",
    from: campaign?.from?.trim() ?? "",
    to: campaign?.to?.trim() ?? "",
  };
};

export const createEmptyDashboardPreferences =
  (): DashboardPreferences => ({
    campaigns: [],
    defaultCampaignId: "",
  });

export const normalizeDashboardPreferences = (
  value: unknown,
): DashboardPreferences => {
  if (!value || typeof value !== "object") {
    return createEmptyDashboardPreferences();
  }

  const candidate = value as Partial<DashboardPreferences>;
  const campaigns = Array.isArray(candidate.campaigns)
    ? candidate.campaigns
        .map((campaign) => normalizeCampaign(campaign))
        .filter((campaign): campaign is DashboardCampaign => Boolean(campaign))
    : [];
  const availableIds = new Set(campaigns.map((campaign) => campaign.id));
  const defaultCampaignId =
    typeof candidate.defaultCampaignId === "string" &&
    availableIds.has(candidate.defaultCampaignId)
      ? candidate.defaultCampaignId
      : "";

  return {
    campaigns,
    defaultCampaignId,
  };
};

export const getDashboardPreferencesStorageKey = (sessionUid: string) =>
  `${STORAGE_PREFIX}:${sessionUid}`;

export const loadDashboardPreferencesFromStorage = (sessionUid: string) => {
  if (typeof window === "undefined") {
    return createEmptyDashboardPreferences();
  }

  const rawValue = window.localStorage.getItem(
    getDashboardPreferencesStorageKey(sessionUid),
  );

  if (!rawValue) {
    return createEmptyDashboardPreferences();
  }

  try {
    return normalizeDashboardPreferences(JSON.parse(rawValue));
  } catch {
    return createEmptyDashboardPreferences();
  }
};

export const saveDashboardPreferencesToStorage = (
  sessionUid: string,
  preferences: DashboardPreferences,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getDashboardPreferencesStorageKey(sessionUid),
    JSON.stringify(normalizeDashboardPreferences(preferences)),
  );
};

export const subscribeToDashboardPreferences = (
  sessionUid: string,
  onNext: (preferences: DashboardPreferences) => void,
  onError?: (error: Error) => void,
): Unsubscribe =>
  onSnapshot(
    doc(getFirebaseDb(), firestoreCollections.users, sessionUid),
    (snapshot) => {
      const data = snapshot.data() as { dashboardPreferences?: unknown } | undefined;
      onNext(normalizeDashboardPreferences(data?.dashboardPreferences));
    },
    (error) => {
      onError?.(error);
    },
  );

export const saveDashboardPreferences = async (
  sessionUid: string,
  preferences: DashboardPreferences,
) =>
  setDoc(
    doc(getFirebaseDb(), firestoreCollections.users, sessionUid),
    {
      dashboardPreferences: normalizeDashboardPreferences(preferences),
    },
    { merge: true },
  );

