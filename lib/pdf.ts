"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Configuracion
const PDF_A4_WIDTH_PX = 794;
const PDF_A4_HEIGHT_PX = 1123;
const PDF_CAPTURE_SCALE = 1.35;
const PDF_JPEG_QUALITY = 0.82;

// Fondo
const getPdfBackgroundColor = (element: HTMLElement) => {
  const elementBackground = getComputedStyle(element).backgroundColor.trim();

  if (elementBackground && elementBackground !== "rgba(0, 0, 0, 0)") {
    return elementBackground;
  }

  return (
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() ||
    "#f5f8fc"
  );
};

// Estructura
const prepareClonedPdfLayout = (
  clonedDocument: Document,
  backgroundColor: string,
) => {
  const clonedExportRoot = clonedDocument.querySelector<HTMLElement>(
    "[data-pdf-export='true']",
  );

  if (clonedExportRoot) {
    clonedExportRoot.style.position = "static";
    clonedExportRoot.style.top = "0";
    clonedExportRoot.style.left = "0";
    clonedExportRoot.style.width = `${PDF_A4_WIDTH_PX}px`;
    clonedExportRoot.style.minWidth = `${PDF_A4_WIDTH_PX}px`;
    clonedExportRoot.style.maxWidth = "none";
    clonedExportRoot.style.visibility = "visible";
    clonedExportRoot.style.opacity = "1";
  }

  clonedDocument
    .querySelectorAll<HTMLElement>("[data-pdf-page='true']")
    .forEach((page) => {
      page.style.width = `${PDF_A4_WIDTH_PX}px`;
      page.style.minWidth = `${PDF_A4_WIDTH_PX}px`;
      page.style.height = `${PDF_A4_HEIGHT_PX}px`;
      page.style.minHeight = `${PDF_A4_HEIGHT_PX}px`;
      page.style.maxHeight = `${PDF_A4_HEIGHT_PX}px`;
      page.style.overflow = "hidden";
    });

  clonedDocument.documentElement.style.width = `${PDF_A4_WIDTH_PX}px`;
  clonedDocument.documentElement.style.minWidth = `${PDF_A4_WIDTH_PX}px`;
  clonedDocument.body.style.width = `${PDF_A4_WIDTH_PX}px`;
  clonedDocument.body.style.minWidth = `${PDF_A4_WIDTH_PX}px`;
  clonedDocument.body.style.margin = "0";
  clonedDocument.body.style.overflow = "hidden";
  clonedDocument.body.style.backgroundColor = backgroundColor;
};

// Exportacion
export const exportElementToPdf = async (
  element: HTMLElement,
  fileName: string,
) => {
  const backgroundColor = getPdfBackgroundColor(element);
  const pages = Array.from(
    element.querySelectorAll<HTMLElement>("[data-pdf-page='true']"),
  );
  const exportPages = pages.length ? pages : [element];
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (const [pageIndex, page] of exportPages.entries()) {
    const canvas = await html2canvas(page, {
      scale: PDF_CAPTURE_SCALE,
      backgroundColor,
      useCORS: true,
      width: PDF_A4_WIDTH_PX,
      height: PDF_A4_HEIGHT_PX,
      windowWidth: PDF_A4_WIDTH_PX,
      windowHeight: PDF_A4_HEIGHT_PX,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDocument) =>
        prepareClonedPdfLayout(clonedDocument, backgroundColor),
    });

    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      canvas.toDataURL("image/jpeg", PDF_JPEG_QUALITY),
      "JPEG",
      0,
      0,
      pageWidth,
      pageHeight,
      undefined,
      "FAST",
    );
  }

  pdf.save(fileName);
};

// Espera
export const waitForPdfLayout = async () =>
  new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const finalize = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(() => resolve(), 48);
        });
      });
    };

    if (typeof document !== "undefined" && "fonts" in document) {
      void document.fonts.ready.then(finalize).catch(finalize);
      return;
    }

    finalize();
  });
