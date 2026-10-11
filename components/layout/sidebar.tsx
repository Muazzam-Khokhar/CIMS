"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront,ChevronDown, X } from "lucide-react";
import { isNavActive, navigation, settingsItem } from "@/lib/nav";
import { useState } from "react";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({
  open,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const SettingsIcon = settingsItem.icon;
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition lg:hidden ${
          open
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`group/sidebar fixed inset-y-0 left-0 z-50 flex w-[76px] flex-col overflow-visible bg-[#07111f] text-white shadow-[8px_0_40px_rgba(2,8,23,0.28)] transition-[width,transform] duration-300 hover:w-[272px] lg:translate-x-0 ${
          open
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-sky-500/20 blur-2xl" />

          <div className="relative flex h-[76px] items-center justify-center px-3 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 shadow-lg shadow-blue-900/40">
              <CarFront className="h-5 w-5 text-white" />
            </div>

            <div className="hidden min-w-0 flex-1 group-hover/sidebar:block">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-300/80 uppercase">
                Workspace
              </p>

              <h1 className="truncate text-lg font-semibold tracking-tight">
                CIMS
              </h1>
            </div>

            {/* Mobile close only */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-white lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1  px-3 py-5">
          <p className="mb-2 hidden px-3 text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase group-hover/sidebar:block">
            Menu
          </p>

          <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const hasChildren = Boolean(item.children?.length);
            const isExpanded = expandedMenu === item.href;

            const active =
              isNavActive(pathname, item.href) ||
              Boolean(
                item.children?.some((child) =>
                  isNavActive(pathname, child.href),
                ),
              );

            return (
              <div
                key={item.href}
                className="group/item relative"
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMenu(
                        isExpanded ? null : item.href,
                      )
                    }
                    className={`flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition ${
                      "justify-center px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3"
                    } ${
                      active
                        ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? "bg-sky-500 text-white"
                          : "bg-white/5 text-slate-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="ml-3 hidden flex-1 truncate text-left group-hover/sidebar:block">
                      {item.name}
                    </span>

                    <ChevronDown
                      className={`mr-1 hidden h-4 w-4 shrink-0 transition group-hover/sidebar:block ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center rounded-xl py-2.5 text-sm font-medium transition ${
                      "justify-center px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3"
                    } ${
                      active
                        ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? "bg-sky-500 text-white"
                          : "bg-white/5 text-slate-400 group-hover/item:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="ml-3 hidden truncate group-hover/sidebar:block">
                      {item.name}
                    </span>
                  </Link>
                )}

                {/* Expenses submenu */}
                {hasChildren && isExpanded && (
                  <div className="mt-1 hidden space-y-1 pl-11 group-hover/sidebar:block">
                    {item.children!.map((child) => {
                      const childActive = isNavActive(
                        pathname,
                        child.href,
                      );

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                            childActive
                              ? "bg-sky-500/15 text-sky-300"
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {/* Bullet */}
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              childActive
                                ? "bg-sky-400"
                                : "bg-slate-500"
                            }`}
                          />

                          <span className="truncate">
                            {child.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Tooltip when collapsed */}
                <div className="pointer-events-none absolute top-1/2 left-full z-[70] ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-xl transition-opacity group-hover/item:opacity-100 group-hover/sidebar:hidden">
                  {item.name}
                </div>
              </div>
            );
          })}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/10 p-3">
          {/* Settings */}
          <div className="group/item relative">
            <Link
              href={settingsItem.href}
              onClick={onClose}
              className={`flex items-center rounded-xl py-2 text-sm font-medium transition ${
                "justify-center px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3"
              } ${
                isNavActive(
                  pathname,
                  settingsItem.href,
                )
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <SettingsIcon className="h-4 w-4" />
              </span>

              <span className="ml-3 hidden group-hover/sidebar:block">
                Settings
              </span>
            </Link>

            {/* Settings tooltip */}
            <div className="pointer-events-none absolute top-1/2 left-full z-[70] ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-xl transition-opacity group-hover/item:opacity-100 group-hover/sidebar:hidden">
              Settings
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
