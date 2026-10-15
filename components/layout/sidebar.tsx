"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isNavActive, navigation, settingsItem } from "@/lib/nav";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

const findOpenMenu = (pathname: string) =>
  navigation.find((item) =>
    item.children?.some((child) =>
      isNavActive(pathname, child.href, child.exact),
    ),
  )?.href ?? null;

/**
 * Desktop: icons only until the sidebar is hovered.
 * Mobile (max-lg): the drawer is always fully open, so everything is shown.
 */
const ROW =
  "flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition " +
  "justify-center px-0 group-hover/sidebar:justify-start group-hover/sidebar:px-3 " +
  "max-lg:justify-start max-lg:px-3";

const LABEL = "ml-3 hidden truncate max-lg:block group-hover/sidebar:block";

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const SettingsIcon = settingsItem.icon;

  const [expandedMenu, setExpandedMenu] = useState<string | null>(() =>
    findOpenMenu(pathname),
  );
  const [menuPath, setMenuPath] = useState(pathname);

  // Re-open the right group when the page changes (no effect needed)
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setExpandedMenu(findOpenMenu(pathname));
  }

  // Mobile drawer: lock page scroll, close on Escape, close if resized to desktop
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", onChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      media.removeEventListener("change", onChange);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`group/sidebar fixed top-0 left-0 z-50 flex h-dvh w-[76px] max-w-[85vw] flex-col overflow-hidden bg-[#07111f] text-white shadow-[8px_0_40px_rgba(2,8,23,0.28)] transition-[width,transform,visibility] duration-300 hover:w-[280px] max-lg:w-[280px] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full max-lg:invisible"
        }`}
      >
        {/* Logo (stays pinned) */}
        <div className="relative shrink-0 overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full bg-sky-500/20 blur-2xl" />

          <div className="relative flex h-[76px] items-center justify-center px-3 group-hover/sidebar:justify-start group-hover/sidebar:px-5 max-lg:justify-start max-lg:px-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 shadow-lg shadow-blue-900/40">
              <CarFront className="h-5 w-5 text-white" />
            </div>

            <div className="ml-3 hidden min-w-0 flex-1 max-lg:block group-hover/sidebar:block">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-300/80 uppercase">
                Workspace
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight">
                CIMS
              </h1>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation (only this part scrolls) */}
        <nav
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:none] group-hover/sidebar:[scrollbar-width:thin] max-lg:[scrollbar-width:thin]"
        >
          <p className="mb-2 hidden px-3 text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase max-lg:block group-hover/sidebar:block">
            Menu
          </p>

          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const hasChildren = Boolean(item.children?.length);
              const isExpanded = expandedMenu === item.href;

              const active =
                isNavActive(pathname, item.href, item.exact) ||
                Boolean(
                  item.children?.some((child) =>
                    isNavActive(pathname, child.href, child.exact),
                  ),
                );

              const rowTone = active
                ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                : "text-slate-400 hover:bg-white/5 hover:text-white";

              const iconTone = active
                ? "bg-sky-500 text-white"
                : "bg-white/5 text-slate-400";

              return (
                <div key={item.href}>
                  {hasChildren ? (
                    <button
                      type="button"
                      title={item.name}
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedMenu(isExpanded ? null : item.href)
                      }
                      className={`${ROW} ${rowTone}`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className={`${LABEL} flex-1 text-left`}>
                        {item.name}
                      </span>

                      <ChevronDown
                        className={`mr-1 hidden h-4 w-4 shrink-0 transition max-lg:block group-hover/sidebar:block ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      title={item.name}
                      onClick={onClose}
                      className={`${ROW} ${rowTone}`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className={LABEL}>{item.name}</span>
                    </Link>
                  )}

                  {/* Submenu */}
                  {hasChildren && isExpanded && (
                    <div className="mt-1 hidden space-y-1 pl-11 max-lg:block group-hover/sidebar:block">
                      {item.children!.map((child) => {
                        const childActive = isNavActive(
                          pathname,
                          child.href,
                          child.exact,
                        );

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition ${
                              childActive
                                ? "bg-sky-500/15 text-sky-300"
                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                childActive ? "bg-sky-400" : "bg-slate-500"
                              }`}
                            />
                            <span className="truncate">{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Settings (stays pinned, clear of the phone's bottom bar) */}
        <div className="shrink-0 border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Link
            href={settingsItem.href}
            title="Settings"
            onClick={onClose}
            className={`${ROW} ${
              isNavActive(pathname, settingsItem.href)
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
              <SettingsIcon className="h-4 w-4" />
            </span>

            <span className={LABEL}>Settings</span>
          </Link>
        </div>
      </aside>
    </>
  );
}