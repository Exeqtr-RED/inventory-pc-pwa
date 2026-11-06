"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventory, getCategories } from "@/lib/inventory";
import { Loader2, Printer, X } from "lucide-react";

interface StickersViewProps {
  open: boolean;
  onClose: () => void;
}

type SizeKey = "s" | "m" | "l";

const SIZES: Record<SizeKey, { label: string; w: number; h: number; qr: number }> = {
  s: { label: "Малые 48×30 мм", w: 48, h: 30, qr: 24 },
  m: { label: "Средние 65×40 мм", w: 65, h: 40, qr: 30 },
  l: { label: "Большие 90×50 мм", w: 90, h: 50, qr: 42 },
};

/**
 * Экран QR-наклеек: генерирует QR-коды (содержимое = инв. №)
 * для всех позиций и выводит их на печать (A4).
 */
export function StickersView({ open, onClose }: StickersViewProps) {
  const items = useInventory((s) => s.items);
  const categories = useMemo(() => getCategories(items), [items]);
  const [cat, setCat] = useState<string>("all");
  const [size, setSize] = useState<SizeKey>("m");
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const filtered = useMemo(
    () =>
      items.filter((i) => cat === "all" || (i.category || "Прочее") === cat),
    [items, cat]
  );

  const needed = useMemo(
    () => filtered.filter((i) => i.inventoryNumber),
    [filtered]
  );
  const generating = needed.some((i) => !qrMap[i.inventoryNumber]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const it of needed) {
        if (cancelled) return;
        const inv = it.inventoryNumber;
        if (!inv || qrMap[inv]) continue;
        try {
          next[inv] = await QRCode.toDataURL(inv, {
            margin: 1,
            width: 320,
            errorCorrectionLevel: "M",
          });
        } catch {
          // пропускаем сбойную позицию
        }
      }
      if (!cancelled && Object.keys(next).length) {
        setQrMap((m) => ({ ...m, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, needed, qrMap]);

  if (!open) return null;

  const s = SIZES[size];
  const ready = filtered.filter((i) => i.inventoryNumber && qrMap[i.inventoryNumber]);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-neutral-100" role="dialog" aria-label="QR-наклейки">
      {/* Панель управления (не печатается) */}
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-white p-3 shadow-sm">
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4" /> Закрыть
        </Button>
        <span className="mr-1 hidden text-sm font-semibold sm:inline">
          Наклейки: {ready.length} шт.
        </span>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-9 w-[190px]">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={size} onValueChange={(v) => setSize(v as SizeKey)}>
          <SelectTrigger className="h-9 w-[190px]">
            <SelectValue placeholder="Размер" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SIZES) as SizeKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SIZES[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {generating && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Генерация…
            </span>
          )}
          <Button
            size="sm"
            onClick={() => window.print()}
            disabled={!ready.length}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <Printer className="h-4 w-4" /> Печать A4
          </Button>
        </div>
      </div>

      {/* Лист наклеек */}
      <div className="print-root mx-auto max-w-4xl p-4">
        <p className="no-print mb-3 text-sm text-muted-foreground">
          QR-код содержит инвентарный номер — при сканировании приложение найдёт
          позицию. Наклейте на корпус техники. Для печати используйте
          самоклеящуюся бумагу A4.
        </p>
        <div className="flex flex-wrap gap-3">
          {ready.map((it) => (
            <div
              key={it.id}
              className="sticker break-inside-avoid flex items-center gap-2 rounded-lg border border-dashed border-neutral-400 bg-white p-2"
              style={{ width: `${s.w}mm`, height: `${s.h}mm` }}
            >
              {/* картинка QR — data URL, генерируется локально */}
              <img
                src={qrMap[it.inventoryNumber]}
                alt={`QR ${it.inventoryNumber}`}
                style={{ width: `${s.qr}mm`, height: `${s.qr}mm` }}
              />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate font-mono text-[11px] font-bold">
                  {it.inventoryNumber}
                </p>
                <p className="line-clamp-2 text-[10px]">{it.name}</p>
                <p className="truncate text-[9px] text-neutral-500">
                  {it.category}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!ready.length && !generating && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Нет позиций с инвентарными номерами — сначала импортируйте список или
            добавьте позиции.
          </p>
        )}
      </div>
    </div>
  );
}
