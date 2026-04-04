"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const exportElementToPdf = async (
  element: HTMLElement,
  fileName: string,
) => {
  const backgroundColor =
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() ||
    "#07111f";

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor,
    useCORS: true,
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
