import type { DashboardCampaign } from "@/types/domain";

export const getCampaignById = (
  campaigns: DashboardCampaign[],
  campaignId: string,
) => campaigns.find((campaign) => campaign.id === campaignId) ?? null;

export const getDefaultCampaignId = (
  campaigns: DashboardCampaign[],
  defaultCampaignId: string,
) =>
  getCampaignById(campaigns, defaultCampaignId)?.id ??
  campaigns[0]?.id ??
  "";

export const getCampaignRange = (
  campaigns: DashboardCampaign[],
  campaignId: string,
) => {
  const campaign = getCampaignById(campaigns, campaignId);

  return {
    campaignId: campaign?.id ?? "",
    from: campaign?.from ?? "",
    to: campaign?.to ?? "",
  };
};

export const getCampaignDisplayName = (
  campaigns: DashboardCampaign[],
  campaignId: string,
) => getCampaignById(campaigns, campaignId)?.name ?? "";

