"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const PDF_EXPORT_WIDTH = 1120;

export const exportElementToPdf = async (
  element: HTMLElement,
  fileName: string,
) => {
  const elementBackground = getComputedStyle(element).backgroundColor.trim();
  const backgroundColor =
    elementBackground && elementBackground !== "rgba(0, 0, 0, 0)"
      ? elementBackground
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--bg")
          .trim() || "#f7fbff";
  const exportWidth = Math.max(
    PDF_EXPORT_WIDTH,
    Math.ceil(element.scrollWidth),
    Math.ceil(element.getBoundingClientRect().width),
  );
  const exportHeight = Math.max(
    Math.ceil(element.scrollHeight),
    Math.ceil(element.getBoundingClientRect().height),
  );

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor,
    useCORS: true,
    width: exportWidth,
    height: exportHeight,
    windowWidth: exportWidth,
    windowHeight: exportHeight,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDocument) => {
      const clonedExportRoot = clonedDocument.querySelector<HTMLElement>(
        "[data-pdf-export='true']",
      );

      if (clonedExportRoot) {
        clonedExportRoot.style.position = "static";
        clonedExportRoot.style.top = "0";
        clonedExportRoot.style.left = "0";
        clonedExportRoot.style.width = `${exportWidth}px`;
        clonedExportRoot.style.minWidth = `${exportWidth}px`;
        clonedExportRoot.style.maxWidth = "none";
        clonedExportRoot.style.visibility = "visible";
        clonedExportRoot.style.opacity = "1";
      }

      clonedDocument.documentElement.style.width = `${exportWidth}px`;
      clonedDocument.body.style.width = `${exportWidth}px`;
      clonedDocument.body.style.margin = "0";
      clonedDocument.body.style.backgroundColor = backgroundColor;
    },
  });

  const imageData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;

  let heightLeft = imageHeight;
  let position = 0;

  pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imageHeight;
    pdf.addPage();
    pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
};

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
