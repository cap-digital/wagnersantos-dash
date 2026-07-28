import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const script = localFont({
  src: "./fonts/Pacifico-Regular.woff2",
  variable: "--font-script",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Painel de Mídia · Wagner Santos",
    template: "%s · Wagner Santos",
  },
  description:
    "Painel de performance das campanhas de Meta Ads da pré-campanha de Wagner Santos — investimento, entrega, custos, taxas e desempenho por criativo.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#080e28",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${script.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
