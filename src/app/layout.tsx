import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", display: "swap" });

export const metadata: Metadata = {
  title: "SignalDesk — Trading Signal Dashboard",
  description: "Educational technical-analysis dashboard with explainable BUY / SELL / NEUTRAL signals, backtesting and risk tools.",
};

export const viewport: Viewport = {
  themeColor: "#0a0d13",
};

// Apply the saved theme before first paint to avoid a flash. Dark is the default.
const themeScript = `try{if(localStorage.getItem("tsd:theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans text-sm">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
