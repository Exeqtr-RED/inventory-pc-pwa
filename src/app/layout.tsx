import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

// Базовый путь задаётся при сборке для GitHub Pages (например, "/inventory-pc").
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Инвентаризация ПК — учёт техники по QR-кодам",
  description:
    "Офлайн-приложение для инвентаризации компьютеров и комплектующих: сканирование QR-кодов, вкладки по категориям, импорт/экспорт Excel и печать QR-наклеек.",
  manifest: `${BASE}/manifest.json`,
  applicationName: "Инвентаризация ПК",
  appleWebApp: {
    capable: true,
    title: "Инвентарь",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: `${BASE}/icons/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
