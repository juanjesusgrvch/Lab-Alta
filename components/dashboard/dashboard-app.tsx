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
import type { DashboardDataMode } from "@/lib/dashboard-data-mode";
import { classNames } from "@/lib/format";
import { getFirebaseAnalytics } from "@/lib/firebase";
import type { DashboardTab } from "@/types/domain";

gsap.registerPlugin(useGSAP);

// Modulos
const tabs: DashboardHeaderTab[] = [
  {
    id: "defects",
    label: "Defectos",
    description: "Lectura por cliente, producto, defecto y proceso.",
  },
  {
    id: "natural",
    label: "Descargas",
    description: "Recepcion, ingreso neto y control analitico asociado.",
  },
  {
    id: "samples",
    label: "Muestras almacenadas",
    description: "Resguardo, vencimientos y trazabilidad de deposito.",
  },
];

interface DashboardAppProps {
  sessionName?: string | null;
  sessionEmail?: string | null;
  sessionWarning?: string | null;
  dataMode?: DashboardDataMode;
  onSignOut: () => void;
}

// Tablero
export const DashboardApp = ({
  sessionName,
  sessionEmail,
  sessionWarning,
  dataMode = "live",
  onSignOut,
}: DashboardAppProps) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("defects");
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
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

  // Tema
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedTheme = window.localStorage.getItem("lab-alta-ui-theme");
    const nextTheme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";

    setThemeMode(nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.uiTheme = themeMode;
    window.localStorage.setItem("lab-alta-ui-theme", themeMode);
  }, [themeMode]);

  // Transicion
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

      gsap.killTweensOf([
        currentPanel,
        nextPanel,
        ...currentTargets,
        ...nextTargets,
      ]);

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

  // Acciones
  const handleTabChange = (nextTab: DashboardTab) => {
    if (nextTab === activeTab || isSwitching) {
      return;
    }

    setPreviousTab(activeTab);
    setIsSwitching(true);
    setActiveTab(nextTab);
  };

  const setPanelRef =
    (tabId: DashboardTab) => (node: HTMLDivElement | null) => {
      panelsRef.current[tabId] = node;
    };

  const handleThemeToggle = () => {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  };

  const sessionLabel =
    sessionName?.trim() || sessionEmail?.trim() || "Sesion Firebase activa";

  // Vista
  return (
    <main
      className={classNames(
        "app-shell",
        `theme-${activeTab}`,
        `mode-${themeMode}`,
      )}
    >
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <DashboardHeader
        activeTab={activeTab}
        tabs={tabs}
        onTabChange={handleTabChange}
        isSwitching={isSwitching}
        themeMode={themeMode}
        onToggleTheme={handleThemeToggle}
        sessionLabel={sessionLabel}
        onSignOut={onSignOut}
      />

      <section className="workspace">
        {sessionWarning ? (
          <section className="card session-bridge">
            <div className="session-bridge__copy">
              <span className="eyebrow">
                {dataMode === "demo" ? "Modo Demo" : "Estado de sesion"}
              </span>
              <h2>
                {dataMode === "demo"
                  ? "Dashboard Demo | Datos temporales"
                  : "Atencion sobre la sesion actual"}
              </h2>
              <p>{sessionWarning}</p>
            </div>
          </section>
        ) : null}

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
            <DefectsModule dataMode={dataMode} />
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
            <NaturalModule dataMode={dataMode} />
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
            <SamplesModule dataMode={dataMode} />
          </div>
        </div>
      </section>
    </main>
  );
};
