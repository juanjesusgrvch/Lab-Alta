"use client";

import { useEffect, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { DefectsModule } from "@/components/modules/defects-module";
import {
  DashboardHeader,
  type DashboardHeaderTab,
} from "@/components/dashboard/dashboard-header";
import { NaturalModule } from "@/components/modules/natural-module";
import { SamplesModule } from "@/components/modules/samples-module";
import { classNames } from "@/lib/format";
import { getFirebaseAnalytics } from "@/lib/firebase";
import type { DashboardTab } from "@/types/domain";

gsap.registerPlugin(useGSAP);

const tabs: Array<DashboardHeaderTab & { toneClass: string }> = [
  {
    id: "defects",
    label: "Defectos",
    description: "Analisis detallado por cliente, producto, defecto y proceso.",
    toneClass: "tab-defects",
  },
  {
    id: "natural",
    label: "Mercaderia al natural",
    description: "Recepcion por camion, stock entrante y analisis opcional.",
    toneClass: "tab-natural",
  },
  {
    id: "samples",
    label: "Muestras almacenadas",
    description: "Trazabilidad del deposito y vencimientos de retencion.",
    toneClass: "tab-samples",
  },
];

export const DashboardApp = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("defects");
  const [previousTab, setPreviousTab] = useState<DashboardTab | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const panelsStageRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<Record<DashboardTab, HTMLDivElement | null>>({
    defects: null,
    natural: null,
    samples: null,
  });
  const transitionTimelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    void getFirebaseAnalytics();
  }, []);

  useGSAP(
    () => {
      const currentPanel = previousTab ? panelsRef.current[previousTab] : null;
      const nextPanel = panelsRef.current[activeTab];

      if (!currentPanel || !nextPanel) {
        return;
      }

      if (!isSwitching || previousTab === activeTab) {
        return;
      }

      transitionTimelineRef.current?.kill();

      const currentTargets = Array.from(
        currentPanel.querySelectorAll(".module-header, .metric-card, .card"),
      );
      const nextTargets = Array.from(
        nextPanel.querySelectorAll(".module-header, .metric-card, .card"),
      );
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        setPreviousTab(null);
        setIsSwitching(false);
        return;
      }

      gsap.killTweensOf([currentPanel, nextPanel, ...currentTargets, ...nextTargets]);

      gsap.set(currentPanel, {
        autoAlpha: 1,
        pointerEvents: "none",
        zIndex: 2,
      });
      gsap.set(nextPanel, {
        autoAlpha: 1,
        visibility: "visible",
        zIndex: 1,
      });
      gsap.set(nextTargets, { autoAlpha: 0, y: 14 });

      const timeline = gsap.timeline({
        defaults: {
          ease: "power2.out",
        },
        onComplete: () => {
          transitionTimelineRef.current = null;
          setPreviousTab(null);
          setIsSwitching(false);
          gsap.set(currentPanel, { clearProps: "all" });
        },
      });

      timeline
        .to(
          currentTargets,
          {
            autoAlpha: 0,
            y: -10,
            duration: 0.16,
            ease: "power2.in",
            stagger: {
              each: 0.018,
              from: "end",
            },
          },
          0,
        )
        .to(
          currentPanel,
          {
            autoAlpha: 0,
            duration: 0.18,
            ease: "power2.in",
          },
          0,
        )
        .to(
          nextTargets,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.24,
            ease: "power2.out",
            stagger: 0.022,
            clearProps: "all",
          },
          0.03,
        );

      transitionTimelineRef.current = timeline;

      return () => timeline.kill();
    },
    {
      dependencies: [activeTab, previousTab, isSwitching],
      revertOnUpdate: true,
      scope: panelsStageRef,
    },
  );

  const handleTabChange = (nextTab: DashboardTab) => {
    if (nextTab === activeTab || isSwitching) {
      return;
    }

    setPreviousTab(activeTab);
    setIsSwitching(true);
    setActiveTab(nextTab);
  };

  const setPanelRef = (tabId: DashboardTab) => (node: HTMLDivElement | null) => {
    panelsRef.current[tabId] = node;
  };

  return (
    <main className={classNames("app-shell", `theme-${activeTab}`)}>
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <DashboardHeader activeTab={activeTab} tabs={tabs} />

      <section className="workspace">
        <div className="tabs-row">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={classNames(
                "tab-button",
                tab.toneClass,
                activeTab === tab.id && "is-active",
              )}
              onClick={() => handleTabChange(tab.id)}
              disabled={isSwitching}
            >
              <strong>{tab.label}</strong>
              <span>{tab.description}</span>
            </button>
          ))}
        </div>

        <div
          ref={panelsStageRef}
          className="tab-panels-stage"
          aria-busy={isSwitching}
        >
          <div
            ref={setPanelRef("defects")}
            className={classNames(
              "tab-panel",
              activeTab === "defects" && "is-active",
              previousTab === "defects" && "is-previous",
            )}
            aria-hidden={activeTab !== "defects"}
          >
            <DefectsModule />
          </div>

          <div
            ref={setPanelRef("natural")}
            className={classNames(
              "tab-panel",
              activeTab === "natural" && "is-active",
              previousTab === "natural" && "is-previous",
            )}
            aria-hidden={activeTab !== "natural"}
          >
            <NaturalModule />
          </div>

          <div
            ref={setPanelRef("samples")}
            className={classNames(
              "tab-panel",
              activeTab === "samples" && "is-active",
              previousTab === "samples" && "is-previous",
            )}
            aria-hidden={activeTab !== "samples"}
          >
            <SamplesModule />
          </div>
        </div>
      </section>
    </main>
  );
};
