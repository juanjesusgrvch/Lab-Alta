"use client";

import { useEffect, useState } from "react";

import { Download, Eye, Pencil, Plus, Save, X } from "lucide-react";

import type {
  DashboardCampaign,
  DashboardPreferences,
} from "@/types/domain";

interface DashboardSettingsPanelProps {
  preferences: DashboardPreferences;
  onChange: (preferences: DashboardPreferences) => void;
  guideDownloadHref: string;
}

const createCampaignDraft = (index: number): DashboardCampaign => ({
  id: crypto.randomUUID(),
  name: `Campana ${index + 1}`,
  from: "",
  to: "",
});

const clonePreferences = (
  preferences: DashboardPreferences,
): DashboardPreferences => ({
  defaultCampaignId: preferences.defaultCampaignId,
  campaigns: preferences.campaigns.map((campaign) => ({
    ...campaign,
  })),
});

const describeCampaignRange = (campaign: DashboardCampaign) => {
  if (campaign.from && campaign.to) {
    return `${campaign.from} a ${campaign.to}`;
  }

  if (campaign.from) {
    return `Desde ${campaign.from}`;
  }

  if (campaign.to) {
    return `Hasta ${campaign.to}`;
  }

  return "Sin rango definido";
};

export const DashboardSettingsPanel = ({
  preferences,
  onChange,
  guideDownloadHref,
}: DashboardSettingsPanelProps) => {
  const [draftPreferences, setDraftPreferences] = useState<DashboardPreferences>(
    () => clonePreferences(preferences),
  );
  const [isCampaignsVisible, setIsCampaignsVisible] = useState(false);
  const [isEditingCampaigns, setIsEditingCampaigns] = useState(false);

  useEffect(() => {
    if (!isEditingCampaigns) {
      setDraftPreferences(clonePreferences(preferences));
    }
  }, [isEditingCampaigns, preferences]);

  const visiblePreferences = isEditingCampaigns
    ? draftPreferences
    : preferences;

  const updateDraftCampaign = (
    campaignId: string,
    patch: Partial<DashboardCampaign>,
  ) => {
    setDraftPreferences((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) =>
        campaign.id === campaignId ? { ...campaign, ...patch } : campaign,
      ),
    }));
  };

  const handleAddCampaign = () => {
    setDraftPreferences((current) => {
      const nextCampaign = createCampaignDraft(current.campaigns.length);

      return {
        campaigns: [...current.campaigns, nextCampaign],
        defaultCampaignId:
          !current.defaultCampaignId && current.campaigns.length === 0
            ? nextCampaign.id
            : current.defaultCampaignId,
      };
    });
  };

  const startEditing = () => {
    setDraftPreferences(clonePreferences(preferences));
    setIsCampaignsVisible(true);
    setIsEditingCampaigns(true);
  };

  const cancelEditing = () => {
    setDraftPreferences(clonePreferences(preferences));
    setIsEditingCampaigns(false);
  };

  const saveEditing = () => {
    const normalizedCampaigns = draftPreferences.campaigns.map(
      (campaign, index) => ({
        ...campaign,
        name: campaign.name.trim() || `Campana ${index + 1}`,
        from: campaign.from.trim(),
        to: campaign.to.trim(),
      }),
    );
    const hasDefaultCampaign = normalizedCampaigns.some(
      (campaign) => campaign.id === draftPreferences.defaultCampaignId,
    );

    onChange({
      campaigns: normalizedCampaigns,
      defaultCampaignId: hasDefaultCampaign
        ? draftPreferences.defaultCampaignId
        : normalizedCampaigns[0]?.id ?? "",
    });
    setIsEditingCampaigns(false);
    setIsCampaignsVisible(true);
  };

  return (
    <div className="dashboard-settings-panel card">
      <div className="dashboard-settings-panel__section">
        <div className="dashboard-settings-panel__heading">
          <div>
            <span className="eyebrow">Opciones</span>
            <h3>Campanas</h3>
            <p>Rangos de fecha reutilizables por usuario.</p>
          </div>

          <div className="dashboard-settings-panel__actions">
            {!isCampaignsVisible ? (
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() => setIsCampaignsVisible(true)}
              >
                <Eye size={14} />
                Ver campanas
              </button>
            ) : null}

            {isCampaignsVisible && !isEditingCampaigns ? (
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={startEditing}
              >
                <Pencil size={14} />
                Editar
              </button>
            ) : null}

            {isEditingCampaigns ? (
              <>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={saveEditing}
                >
                  <Save size={14} />
                  Guardar
                </button>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={cancelEditing}
                >
                  <X size={14} />
                  Cancelar
                </button>
              </>
            ) : null}
          </div>
        </div>

        {isCampaignsVisible ? (
          visiblePreferences.campaigns.length ? (
            <div
              className={
                isEditingCampaigns
                  ? "dashboard-settings-panel__campaigns dashboard-settings-panel__campaigns--editing"
                  : "dashboard-settings-panel__campaigns dashboard-settings-panel__campaigns--compact"
              }
            >
              {visiblePreferences.campaigns.map((campaign) =>
                isEditingCampaigns ? (
                  <article
                    key={campaign.id}
                    className="dashboard-settings-panel__campaign"
                  >
                    <div className="dashboard-settings-panel__campaign-grid">
                      <label>
                        Nombre
                        <input
                          type="text"
                          value={campaign.name}
                          onChange={(event) =>
                            updateDraftCampaign(campaign.id, {
                              name: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Desde
                        <input
                          type="date"
                          value={campaign.from}
                          onChange={(event) =>
                            updateDraftCampaign(campaign.id, {
                              from: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Hasta
                        <input
                          type="date"
                          value={campaign.to}
                          onChange={(event) =>
                            updateDraftCampaign(campaign.id, {
                              to: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="checkbox-row dashboard-settings-panel__default">
                        <input
                          type="checkbox"
                          checked={
                            draftPreferences.defaultCampaignId === campaign.id
                          }
                          onChange={(event) =>
                            setDraftPreferences((current) => ({
                              ...current,
                              defaultCampaignId: event.target.checked
                                ? campaign.id
                                : "",
                            }))
                          }
                        />
                        <span>Predeterminada</span>
                      </label>
                    </div>
                  </article>
                ) : (
                  <article
                    key={campaign.id}
                    className="dashboard-settings-panel__campaign dashboard-settings-panel__campaign--summary"
                  >
                    <div className="dashboard-settings-panel__campaign-header">
                      <strong>{campaign.name || "Campana sin nombre"}</strong>
                      {preferences.defaultCampaignId === campaign.id ? (
                        <span className="dashboard-settings-panel__badge">
                          Predeterminada
                        </span>
                      ) : null}
                    </div>
                    <p className="dashboard-settings-panel__campaign-range">
                      {describeCampaignRange(campaign)}
                    </p>
                  </article>
                ),
              )}

              {isEditingCampaigns ? (
                <div className="dashboard-settings-panel__campaign-footer">
                  <button
                    type="button"
                    className="ghost-button compact-button"
                    onClick={handleAddCampaign}
                  >
                    <Plus size={14} />
                    Agregar campana
                  </button>
                </div>
              ) : (
                <div className="dashboard-settings-panel__campaign-footer">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setIsCampaignsVisible(false)}
                  >
                    Ocultar campanas
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="dashboard-settings-panel__empty-shell">
              <p className="dashboard-settings-panel__empty">
                Todavia no hay campanas guardadas.
              </p>
              {isEditingCampaigns ? (
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={handleAddCampaign}
                >
                  <Plus size={14} />
                  Agregar campana
                </button>
              ) : (
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={startEditing}
                >
                  <Pencil size={14} />
                  Crear campanas
                </button>
              )}
            </div>
          )
        ) : null}
      </div>

      <div className="dashboard-settings-panel__section">
        <a
          href={guideDownloadHref}
          download="guia_procesos.jpg"
          className="ghost-button dashboard-settings-panel__download"
        >
          <Download size={15} />
          Descargar guia de procesos
        </a>
      </div>
    </div>
  );
};
