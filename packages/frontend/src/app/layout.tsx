import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCodeHandler from "./components/AuthCodeHandler";
import "./globals.css";

export const metadata: Metadata = {
  title: "KabuTrade - デモトレード",
  description: "日本株・米国株のデモトレードプラットフォーム",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <Suspense><AuthCodeHandler /></Suspense>
        {children}
      </body>
    </html>
  );
}
