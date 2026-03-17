"use client";

import AuthGuard from "@/app/components/layout/AuthGuard";
import Sidebar from "@/app/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto pt-12 md:pt-0">{children}</main>
      </div>
    </AuthGuard>
  );
}
