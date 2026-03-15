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
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
