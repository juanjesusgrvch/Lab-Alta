import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";

import "./globals.css";

// Fuentes
const headingFont = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Lab Alta | Control Operativo",
  description:
    "Control operativo con login Firebase para defectos, descargas y muestras.",
};

// Estructura
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
