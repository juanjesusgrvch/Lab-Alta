import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";

import "./globals.css";

const headingFont = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Lab Alta Dashboard",
  description:
    "Dashboard operativo para defectos, mercaderia al natural y control de muestras con Next.js, TypeScript y Firebase.",
};

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
