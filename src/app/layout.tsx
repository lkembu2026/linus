import type { Metadata, Viewport } from "next";
import { Poppins, Roboto, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegistration } from "@/components/sw-register";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const roboto = Roboto({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const viewport: Viewport = {
  themeColor: "#0D0D0D",
};

export const metadata: Metadata = {
  title: "LK PharmaCare — Pharmacy Operating System",
  description:
    "Multi-Branch, Offline-First Pharmacy Operating System. Real-time POS, inventory management, and analytics.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${roboto.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
        <ServiceWorkerRegistration />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1A1A1A",
              border: "1px solid rgba(0, 255, 224, 0.2)",
              color: "#FFFFFF",
            },
          }}
        />
      </body>
    </html>
  );
}
