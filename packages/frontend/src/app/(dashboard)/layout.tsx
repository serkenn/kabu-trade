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
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
