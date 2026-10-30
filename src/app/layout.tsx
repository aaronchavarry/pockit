import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { ServiceWorkerRegistration } from "@/components/layout/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Pockit", template: "%s · Pockit" },
  description: "A calm, lightweight personal expense tracker.",
  applicationName: "Pockit",
  appleWebApp: { capable: true, title: "Pockit", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="antialiased">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
