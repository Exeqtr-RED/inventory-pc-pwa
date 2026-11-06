"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BannerState {
  kind: "success" | "info" | "error";
  title: string;
  subtitle?: string;
  at: number;
}

export function ScanBanner({
  banner,
  onAdd,
  onDismiss,
}: {
  banner: BannerState;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 rounded-xl border p-3 shadow-lg backdrop-blur",
        banner.kind === "success" &&
          "border-green-500/40 bg-green-600/95 text-white",
        banner.kind === "info" && "border-slate-400/40 bg-slate-700/95 text-white",
        banner.kind === "error" && "border-red-500/40 bg-red-600/95 text-white"
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold leading-snug">{banner.title}</p>
      {banner.subtitle && (
        <p className="mt-0.5 break-all text-xs opacity-90">{banner.subtitle}</p>
      )}
      {banner.kind === "error" && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 bg-white text-red-700 hover:bg-white/90"
            onClick={onAdd}
          >
            + Добавить позицию
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-white hover:bg-white/20"
            onClick={onDismiss}
          >
            Скрыть
          </Button>
        </div>
      )}
    </div>
  );
}
