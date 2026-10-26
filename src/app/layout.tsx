import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const metadata: Metadata = {
  title: { default: "Survey Phone Tracker", template: "%s · Survey Phone Tracker" },
  description: "Track survey phone readiness, allocation, returns, and faults.",
  applicationName: "Survey Phone Tracker",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Phone Tracker" }
};

export const viewport: Viewport = { themeColor: "#27166e", colorScheme: "light" };

const bodyFont = Source_Sans_3({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const dataFont = Barlow_Condensed({ subsets: ["latin"], variable: "--font-data", weight: ["500", "600", "700", "800"], display: "swap" });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${dataFont.variable}`}>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
