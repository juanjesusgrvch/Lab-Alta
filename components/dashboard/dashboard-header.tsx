"use client";

import { useRef } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Moon, SunMedium } from "lucide-react";

import { classNames } from "@/lib/format";
import type { DashboardTab } from "@/types/domain";

gsap.registerPlugin(useGSAP);

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
}

export const DashboardHeader = ({
  activeTab,
  tabs,
  onTabChange,
  isSwitching,
  themeMode,
  onToggleTheme,
}: DashboardHeaderProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeTabIndex = Math.max(
    tabs.findIndex((tab) => tab.id === activeTab),
    0,
  );
  const ThemeIcon = themeMode === "dark" ? SunMedium : Moon;

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

  return (
    <header ref={containerRef} className="dashboard-console">
      <div className="dashboard-console__topbar dashboard-console__fade">
        <div className="dashboard-console__identity">
          <strong>ALTA S.A.</strong>
          <span className="dashboard-console__status">
            <span className="dashboard-console__status-dot" />
            Live
          </span>
        </div>

        <div className="dashboard-console__actions">
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
            <span>{themeMode === "dark" ? "Claro" : "Oscuro"}</span>
          </button>

          <button
            type="button"
            className="dashboard-console__avatar"
            aria-label="Perfil de Alta"
          >
            AL
          </button>
        </div>
      </div>

      <div className="dashboard-console__deck">
        <div key={activeTab} className="dashboard-console__active dashboard-console__fade">
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
