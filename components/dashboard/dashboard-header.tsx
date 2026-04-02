"use client";

import { useRef } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Activity, ArrowUpRight, Boxes, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
}

const highlights: Array<{
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    label: "Cobertura",
    value: "3 modulos",
    detail: "defectos, recepcion y muestras dentro del mismo flujo",
    icon: Boxes,
  },
  {
    label: "Ritmo",
    value: "Cambio inmediato",
    detail: "el contexto visual cambia sin romper la lectura operativa",
    icon: Activity,
  },
  {
    label: "Lectura",
    value: "Mas limpia",
    detail: "una cabecera compacta para orientar rapido cada sesion",
    icon: ShieldCheck,
  },
];

export const DashboardHeader = ({
  activeTab,
  tabs,
}: DashboardHeaderProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const introTimeline = gsap.timeline({
          defaults: {
            duration: 0.78,
            ease: "power3.out",
          },
        });

        introTimeline
          .from(".dashboard-hero__fade", {
            y: 28,
            autoAlpha: 0,
            stagger: 0.08,
            clearProps: "all",
          })
          .from(
            ".dashboard-hero__metric",
            {
              y: 18,
              autoAlpha: 0,
              stagger: 0.07,
              clearProps: "all",
            },
            "<0.14",
          )
          .from(
            ".dashboard-hero__module",
            {
              x: 20,
              autoAlpha: 0,
              stagger: 0.06,
              clearProps: "all",
            },
            "<0.1",
          );

        gsap.to(".dashboard-hero__halo--primary", {
          xPercent: 10,
          yPercent: -8,
          duration: 10,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        gsap.to(".dashboard-hero__halo--secondary", {
          xPercent: -8,
          yPercent: 10,
          duration: 12,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        gsap.to(".dashboard-hero__status-dot", {
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
        gsap.from(".dashboard-hero__active-content", {
          y: 14,
          autoAlpha: 0,
          duration: 0.42,
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
    <header ref={containerRef} className="dashboard-hero card">
      <div className="dashboard-hero__backdrop" aria-hidden="true">
        <span className="dashboard-hero__halo dashboard-hero__halo--primary" />
        <span className="dashboard-hero__halo dashboard-hero__halo--secondary" />
      </div>

      <div className="dashboard-hero__layout">
        <div className="dashboard-hero__copy">
          <div className="dashboard-hero__topline dashboard-hero__fade">
            <span className="eyebrow">Lab Alta / tablero operativo</span>
            <span className="dashboard-hero__status">
              <span className="dashboard-hero__status-dot" />
              interfaz unificada
            </span>
          </div>

          <h1 className="dashboard-hero__title dashboard-hero__fade">
            Calidad, recepcion y resguardo con una cabecera mas clara.
          </h1>

          <p className="dashboard-hero__description dashboard-hero__fade">
            Una entrada mas limpia para alternar entre defectos, mercaderia al
            natural y muestras almacenadas sin perder continuidad visual.
          </p>

          <div className="dashboard-hero__metrics">
            {highlights.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.label} className="dashboard-hero__metric">
                  <div className="dashboard-hero__metric-icon">
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="dashboard-hero__panel dashboard-hero__fade">
          <div key={activeTab} className="dashboard-hero__active-content">
            <span className="dashboard-hero__panel-label">Ahora en foco</span>
            <div className="dashboard-hero__panel-title">
              <strong>{activeTabConfig.label}</strong>
              <ArrowUpRight size={18} strokeWidth={1.8} />
            </div>
            <p>{activeTabConfig.description}</p>
          </div>

          <div className="dashboard-hero__module-list">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                className={classNames(
                  "dashboard-hero__module",
                  activeTab === tab.id && "is-active",
                )}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{tab.label}</strong>
                  <p>{tab.description}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </header>
  );
};
