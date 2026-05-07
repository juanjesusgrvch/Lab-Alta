"use client";

import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { LogOut, Moon, Settings2, SunMedium } from "lucide-react";

import { DashboardSettingsPanel } from "@/components/dashboard/dashboard-settings-panel";
import { classNames } from "@/lib/format";
import type {
  DashboardPreferences,
  DashboardTab,
} from "@/types/domain";

gsap.registerPlugin(useGSAP);

// Tipos
export interface DashboardHeaderTab {
  id: DashboardTab;
  label: string;
  description: string;
}

interface DashboardHeaderProps {
  activeTab: DashboardTab;
  tabs: DashboardHeaderTab[];
  onTabChange: (tab: DashboardTab) => void;
  isSwitching: boolean;
  themeMode: "dark" | "light";
  onToggleTheme: () => void;
  sessionLabel: string;
  onSignOut: () => void;
  preferences: DashboardPreferences;
  onPreferencesChange: (preferences: DashboardPreferences) => void;
  guideDownloadHref: string;
}

// Sesion
const getSessionInitials = (value: string) => {
  const initials = value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "AL";
};

// Cabecera
export const DashboardHeader = ({
  activeTab,
  tabs,
  onTabChange,
  isSwitching,
  themeMode,
  onToggleTheme,
  sessionLabel,
  onSignOut,
  preferences,
  onPreferencesChange,
  guideDownloadHref,
}: DashboardHeaderProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeTabIndex = Math.max(
    tabs.findIndex((tab) => tab.id === activeTab),
    0,
  );
  const ThemeIcon = themeMode === "dark" ? SunMedium : Moon;
  const sessionInitials = getSessionInitials(sessionLabel);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        !settingsRef.current?.contains(target) &&
        !target?.closest("[data-dashboard-settings-trigger='true']")
      ) {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  // Acciones
  const renderSessionActions = ({
    className,
    includeAvatar,
  }: {
    className?: string;
    includeAvatar: boolean;
  }) => (
    <div className={classNames("dashboard-console__actions", className)}>
      <span className="dashboard-console__session-label" title={sessionLabel}>
        {sessionLabel}
      </span>

      <button
        type="button"
        className="dashboard-console__theme-toggle"
        onClick={onToggleTheme}
        aria-pressed={themeMode === "light"}
        aria-label={
          themeMode === "dark"
            ? "Cambiar a tema claro"
            : "Cambiar a tema oscuro"
        }
      >
        <ThemeIcon size={15} strokeWidth={1.9} />
        <span>{themeMode === "dark" ? "Tema" : "Tema"}</span>
      </button>

      <button
        type="button"
        className="dashboard-console__theme-toggle"
        onClick={() => setIsSettingsOpen((current) => !current)}
        aria-expanded={isSettingsOpen}
        aria-label="Abrir opciones del dashboard"
        data-dashboard-settings-trigger="true"
      >
        <Settings2 size={15} strokeWidth={1.9} />
        <span>Opciones</span>
      </button>

      {includeAvatar ? (
        <button
          type="button"
          className="dashboard-console__avatar"
          aria-label={`Sesion activa de ${sessionLabel}`}
        >
          {sessionInitials}
        </button>
      ) : null}

      <button
        type="button"
        className="dashboard-console__logout"
        onClick={onSignOut}
        aria-label="Cerrar sesion"
      >
        <LogOut size={15} strokeWidth={1.9} />
        <span>Salir</span>
      </button>
    </div>
  );

  // Animacion
  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const introTimeline = gsap.timeline({
          defaults: {
            duration: 0.72,
            ease: "power3.out",
          },
        });

        introTimeline
          .from(".dashboard-console__fade", {
            y: 18,
            autoAlpha: 0,
            stagger: 0.06,
            clearProps: "all",
          })
          .from(
            ".dashboard-console__tab",
            {
              y: 14,
              autoAlpha: 0,
              stagger: 0.06,
              clearProps: "all",
            },
            "<0.08",
          );

        gsap.to(".dashboard-console__status-dot", {
          scale: 1.08,
          opacity: 0.62,
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      return () => media.revert();
    },
    { scope: containerRef },
  );

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".dashboard-console__active", {
          y: 12,
          autoAlpha: 0,
          duration: 0.36,
          ease: "power2.out",
          clearProps: "all",
        });
      });

      return () => media.revert();
    },
    {
      dependencies: [activeTab],
      revertOnUpdate: true,
      scope: containerRef,
    },
  );

  // Vista
  return (
    <header ref={containerRef} className="dashboard-console">
      <div className="dashboard-console__topbar dashboard-console__fade">
        <div className="dashboard-console__identity">
          <strong>ALTA S.A.</strong>
          <span className="dashboard-console__status">
            <span className="dashboard-console__status-dot" />
            conectado
          </span>
        </div>

        {renderSessionActions({
          className: "dashboard-console__actions--desktop",
          includeAvatar: true,
        })}

        <details className="dashboard-console__mobile-nav">
          <summary
            className="dashboard-console__avatar dashboard-console__menu-toggle"
            aria-label={`Abrir menu de sesion de ${sessionLabel}`}
          >
            {sessionInitials}
          </summary>

          {renderSessionActions({
            className: "dashboard-console__actions--mobile",
            includeAvatar: false,
          })}
        </details>
      </div>

      <div
        ref={settingsRef}
        className={classNames(
          "dashboard-console__settings-panel",
          isSettingsOpen && "is-open",
        )}
      >
        <DashboardSettingsPanel
          preferences={preferences}
          onChange={onPreferencesChange}
          guideDownloadHref={guideDownloadHref}
        />
      </div>

      <div className="dashboard-console__deck">
        <div
          key={activeTab}
          className="dashboard-console__active dashboard-console__fade"
        >
          <span className="eyebrow">
            Modulo {String(activeTabIndex + 1).padStart(2, "0")}
          </span>
          <h1>{activeTabConfig.label}</h1>
          <p>{activeTabConfig.description}</p>
        </div>

        <div
          className="dashboard-console__switcher dashboard-console__fade"
          role="tablist"
          aria-label="Modulos del dashboard"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={classNames(
                "dashboard-console__tab",
                activeTab === tab.id && "is-active",
              )}
              onClick={() => onTabChange(tab.id)}
              disabled={isSwitching}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{tab.label}</strong>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
