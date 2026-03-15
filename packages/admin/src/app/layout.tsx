import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KabuTrade Admin - 管理画面",
  description: "KabuTrade デモトレード管理パネル",
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
