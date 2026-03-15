"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/app/components/layout/AuthGuard";
import Sidebar from "@/app/components/layout/Sidebar";

function AdminRoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "ADMIN") {
      alert("管理者権限が必要です");
      router.push("/login");
    }
  }, [user, loading, router]);

  if (!user || user.role !== "ADMIN") return null;

  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AdminRoleGuard>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </AdminRoleGuard>
    </AuthGuard>
  );
}
