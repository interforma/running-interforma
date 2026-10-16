import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Outfit } from "next/font/google";
import "./globals.css";

const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const display = Outfit({ subsets: ["latin"], weight: ["500"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Running Interforma",
  description: "Tu asistente para correr: qué toca hoy, registro de salidas y el comentario de tu entrenador.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Running", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-180.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#281F18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
