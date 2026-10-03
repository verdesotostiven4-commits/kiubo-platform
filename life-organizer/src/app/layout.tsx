import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/shared/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Harmony OS — Planificador ESPOCH",
  description:
    "Tu vida universitaria y personal, organizada con calma. Horario ESPOCH, finanzas, tareas y bienestar en un solo lugar.",
  manifest: "/manifest.json",
  applicationName: "Harmony OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Harmony OS",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon.svg" },
    ],
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
