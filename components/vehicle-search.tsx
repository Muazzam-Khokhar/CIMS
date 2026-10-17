"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront, Search } from "lucide-react";

type Result = {
  _id: string;
  name: string;
  model?: string;
  color?: string;
  chassisNumber?: string;
  registrationNumber?: string;
  status: "AVAILABLE" | "SOLD" | "DISCARDED";
};

const STATUS = {
  AVAILABLE: { label: "Available", cls: "bg-emerald-50 text-emerald-700" },
  SOLD: { label: "Sold", cls: "bg-blue-50 text-blue-700" },
  DISCARDED: { label: "Discarded", cls: "bg-red-50 text-red-700" },
} as const;

export function VehicleSearch({
  autoFocus = false,
  onSelect,
}: {
  autoFocus?: boolean;
  onSelect?: () => void;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const boxRef = useRef<HTMLDivElement>(null);

  // Search 300ms after the user stops typing
  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: "1", limit: "8", search: q });
        const res = await fetch(`/api/vehicles?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);

        setResults(json.data ?? []);
        setActive(0);
        setLoading(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setResults([]);
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close when clicking outside
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (car: Result) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    onSelect?.();
    router.push(`/inventory/${car._id}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  };

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={boxRef} className="relative w-full md:w-80">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />

      <input
        type="text"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search car by name or model..."
        aria-label="Search cars"
        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
      />

      {showPanel && (
        <div className="absolute top-full right-0 z-50 mt-2 w-full min-w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-80 overflow-y-auto p-1">
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">
                Searching...
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">
                No cars found
              </p>
            ) : (
              results.map((car, index) => {
                const status = STATUS[car.status];
                return (
                  <button
                    key={car._id}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(car)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                      index === active ? "bg-sky-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <CarFront className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {car.name} {car.model}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {[car.color, car.chassisNumber, car.registrationNumber]
                          .filter(Boolean)
                          .join(" · ") || "No details"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}