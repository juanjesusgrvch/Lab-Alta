"use client";

import { forwardRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { SectionCard } from "@/components/dashboard/primitives";
import { classNames } from "@/lib/format";

// Filtros
export type PdfExportFilterItem = {
  label: string;
  value: string;
};

// Paginacion
export const PDF_HISTORY_CARDS_PER_PAGE = 3;

export function chunkPdfItems<T>(
  items: T[],
  size = PDF_HISTORY_CARDS_PER_PAGE,
) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

// Portal
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

// Paginas
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

export const PdfExportPage = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={classNames("pdf-export-page", className)}
    data-pdf-page="true"
  >
    {children}
  </section>
);

// Secciones
export const PdfHistoryCardsSection = ({
  title,
  children,
  className,
  listClassName,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  listClassName?: string;
}) => (
  <SectionCard
    title={title}
    className={classNames("pdf-export-history-section", className)}
  >
    <div className={classNames("pdf-export-history-list", listClassName)}>
      {children}
    </div>
  </SectionCard>
);

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
