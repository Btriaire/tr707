import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TR-707 — Rhythm Composer",
  description:
    "Émulation Web Audio de la Roland TR-707 : 15 voix de batterie synthétisées, séquenceur 16 pas par instrument, shuffle, 8 patterns.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#c9cbc8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
