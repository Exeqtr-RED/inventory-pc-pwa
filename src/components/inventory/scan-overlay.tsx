"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanBanner, type BannerState } from "./scan-banner";
import { useInventory } from "@/lib/inventory";
import { beep, vibrate } from "@/lib/feedback";

interface ScanOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Открыть диалог добавления позиции с предзаполненным инв.№ */
  onManualAdd: (code: string) => void;
}

/**
 * Полноэкранный QR-сканер: камера + jsQR, непрерывный режим.
 * Найденный код отмечает позицию зелёным и переносит её в конец списка.
 */
export function ScanOverlay({ open, onClose, onManualAdd }: ScanOverlayProps) {
  const scan = useInventory((s) => s.scan);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScan = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const busyRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [manual, setManual] = useState("");
  const [flash, setFlash] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleCode = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const now = Date.now();
      // Дедупликация: тот же код не чаще раза в 1.5 с
      if (code === lastScan.current.code && now - lastScan.current.time < 1500)
        return;
      lastScan.current = { code, time: now };
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const res = scan(code);
        if (res.outcome === "found") {
          beep(920, 0.12);
          vibrate(80);
          setFlash(true);
          setTimeout(() => setFlash(false), 350);
          setBanner({
            kind: "success",
            title: `✓ Найдено: ${res.item!.name}`,
            subtitle: `${res.item!.inventoryNumber} — отмечено и перемещено в конец списка`,
            at: Date.now(),
          });
          setTimeout(() => {
            setBanner((b) =>
              b && b.kind === "success" && Date.now() - b.at >= 2800 ? null : b
            );
          }, 3000);
        } else if (res.outcome === "already") {
          beep(650, 0.1);
          setBanner({
            kind: "info",
            title: `Уже отмечено: ${res.item!.name}`,
            subtitle: `${res.item!.inventoryNumber} — позиция уже в наличии`,
            at: Date.now(),
          });
          setTimeout(() => {
            setBanner((b) =>
              b && b.kind === "info" && Date.now() - b.at >= 2800 ? null : b
            );
          }, 3000);
        } else {
          beep(220, 0.25, "square");
          vibrate([120, 80, 120]);
          setBanner({
            kind: "error",
            title: "Код не найден в списке",
            subtitle: code,
            at: Date.now(),
          });
        }
      } finally {
        busyRef.current = false;
      }
    },
    [scan]
  );

  /* Запуск камеры */
  useEffect(() => {
    if (!open) {
      stopCamera();
      setBanner(null);
      setTorchOn(false);
      setError(null);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        // Проверка фонарика
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as
          | { torch?: boolean }
          | undefined;
        setTorchAvailable(Boolean(caps?.torch));

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = () => {
          rafRef.current = requestAnimationFrame(tick);
          const v = videoRef.current;
          if (!v || v.readyState < 2 || !ctx) return;
          const w = v.videoWidth;
          const h = v.videoHeight;
          if (!w || !h) return;
          // Масштабирование для производительности
          const scale = Math.min(1, 640 / w);
          const cw = Math.round(w * scale);
          const ch = Math.round(h * scale);
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }
          ctx.drawImage(v, 0, 0, cw, ch);
          const img = ctx.getImageData(0, 0, cw, ch);
          const qr = jsQR(img.data, cw, ch, {
            inversionAttempts: "dontInvert",
          });
          if (qr?.data) handleCode(qr.data);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "";
        if (name === "NotAllowedError") {
          setError(
            "Нет доступа к камере. Разрешите камеру в настройках браузера (значок замка в адресной строке) и попробуйте снова."
          );
        } else if (name === "NotFoundError") {
          setError("Камера не найдена на этом устройстве.");
        } else {
          setError(
            "Не удалось включить камеру. Проверьте разрешения и попробуйте снова."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera, handleCode]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black" role="dialog" aria-label="Сканирование QR-кода">
      {/* Видео */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      {/* Затемнение с окошком визира */}
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <div className="pointer-events-none absolute left-1/2 top-[14%] -translate-x-1/2">
        <div className="relative h-56 w-56 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] sm:h-64 sm:w-64">
          <div className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-green-400" />
          <div className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-green-400" />
          <div className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-green-400" />
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-green-400" />
          <div className="scanline absolute left-3 right-3 top-0 h-0.5 rounded bg-green-400/90" />
        </div>
        <p className="mt-4 text-center text-sm text-white/80">
          Наведите камеру на QR-код
        </p>
      </div>
      {flash && (
        <div className="pointer-events-none absolute inset-0 bg-green-400/30" />
      )}

      {/* Верхняя панель */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="bg-black/50 text-white hover:bg-black/70"
        >
          ✕ Закрыть
        </Button>
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/90">
          Сканирование…
        </span>
        {torchAvailable ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleTorch}
            className="bg-black/50 text-white hover:bg-black/70"
          >
            {torchOn ? "🔆 Свет выкл." : "🔅 Фонарь"}
          </Button>
        ) : (
          <span className="w-[104px]" aria-hidden />
        )}
      </div>

      {/* Ошибки камеры */}
      {error && (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl bg-red-950/90 p-4 text-center text-sm text-red-100">
          {error}
        </div>
      )}

      {/* Баннер результата */}
      <div className="absolute inset-x-3 bottom-24 z-10">
        {banner && (
          <ScanBanner
            banner={banner}
            onAdd={() => {
              onManualAdd(banner.subtitle ?? "");
              setBanner(null);
            }}
            onDismiss={() => setBanner(null)}
          />
        )}
      </div>

      {/* Ручной ввод */}
      <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleCode(manual);
            setManual("");
          }}
        >
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Инв. № вручную (напр. PC-0001)"
            className="bg-white/10 text-white placeholder:text-white/40"
            aria-label="Ручной ввод инвентарного номера"
          />
          <Button
            type="submit"
            className="shrink-0 bg-green-600 text-white hover:bg-green-700"
          >
            Найти
          </Button>
        </form>
      </div>
    </div>
  );
}
