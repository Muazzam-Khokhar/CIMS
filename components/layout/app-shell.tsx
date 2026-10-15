"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the mobile drawer whenever the page changes
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setSidebarOpen(false);
  }

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="min-h-dvh bg-[#f3f6fb]">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      {/* On desktop, content starts after the collapsed sidebar */}
      <div className="lg:pl-[76px]">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}