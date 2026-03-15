import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KabuTrade - デモトレード",
  description: "日本株・米国株のデモトレードプラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
