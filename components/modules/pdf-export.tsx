"use client";

import { forwardRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { SectionCard } from "@/components/dashboard/primitives";
import { classNames } from "@/lib/format";

export type PdfExportFilterItem = {
  label: string;
  value: string;
};

export const PdfExportPortal = ({ children }: { children: ReactNode }) => {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pdf-export-layer" aria-hidden="true">
      {children}
    </div>,
    document.body,
  );
};

export const PdfExportRoot = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    className?: string;
  }
>(({ children, className }, ref) => (
  <div
    ref={ref}
    data-pdf-export="true"
    className={classNames("module-stack", "pdf-export-root", className)}
  >
    {children}
  </div>
));

PdfExportRoot.displayName = "PdfExportRoot";

export const PdfSelectedFiltersSection = ({
  items,
  className,
}: {
  items: PdfExportFilterItem[];
  className?: string;
}) => {
  if (!items.length) {
    return null;
  }

  return (
    <SectionCard
      title="Filtros aplicados"
      className={classNames("pdf-export-filters-card", className)}
    >
      <div className="record-card__extended-grid pdf-export-filters-grid">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};
