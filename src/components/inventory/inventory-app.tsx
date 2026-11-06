"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleSlash,
  Clock,
  FileDown,
  ListChecks,
  Menu,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useInventory,
  computeStats,
  fmtDateTime,
  getCategories,
  sortForDisplay,
  statsForCategory,
  type InvItem,
} from "@/lib/inventory";
import {
  buildReportBlob,
  buildTemplateBlob,
  parseWorkbook,
  shareOrDownload,
} from "@/lib/xlsx-ops";
import { ScanOverlay } from "./scan-overlay";
import { ItemDialog } from "./item-dialog";
import { StickersView } from "./stickers-view";
import { PwaRegister } from "./pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function InventoryApp() {
  // true только после гидратации — к этому моменту zustand прочитает localStorage
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="flex items-center gap-3 text-neutral-500">
          <ListChecks className="h-6 w-6 animate-pulse text-green-600" />
          <span className="text-sm font-medium">Загрузка инвентаризации…</span>
        </div>
      </div>
    );
  }
  return (
    <>
      <InventoryInner />
      <Toaster position="top-center" richColors />
    </>
  );
}

function InventoryInner() {
  const items = useInventory((s) => s.items);
  const activeTab = useInventory((s) => s.activeTab);
  const setActiveTab = useInventory((s) => s.setActiveTab);
  const togglePresent = useInventory((s) => s.togglePresent);
  const markMissing = useInventory((s) => s.markMissing);
  const deleteItem = useInventory((s) => s.deleteItem);
  const importReplace = useInventory((s) => s.importReplace);
  const importAppend = useInventory((s) => s.importAppend);
  const resetStatuses = useInventory((s) => s.resetStatuses);
  const loadDemo = useInventory((s) => s.loadDemo);
  const clearAll = useInventory((s) => s.clearAll);

  const [scanOpen, setScanOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InvItem | null>(null);
  const [presetInv, setPresetInv] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<InvItem | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [importState, setImportState] = useState<{
    rows: ReturnType<typeof parseWorkbook>["rows"];
    filename: string;
  } | null>(null);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const categories = useMemo(() => getCategories(items), [items]);
  const stats = useMemo(() => computeStats(items), [items]);

  const visible = useMemo(() => {
    let list = items;
    if (activeTab !== "all") {
      list = list.filter((i) => (i.category || "Прочее") === activeTab);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        [i.inventoryNumber, i.name, i.description, i.category]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return sortForDisplay(list);
  }, [items, activeTab, query]);

  /* ── Действия ── */

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      if (!parsed.rows.length) {
        toast.error("В файле не найдено позиций", {
          description: "Проверьте, что лист содержит колонки: Категория, Инв.№, Название, Описание.",
        });
        return;
      }
      setImportState({ rows: parsed.rows, filename: file.name });
    } catch {
      toast.error("Не удалось прочитать файл", {
        description: "Поддерживаются файлы Excel (.xlsx).",
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleExport = async () => {
    if (!items.length) {
      toast.error("Список пуст — нечего экспортировать");
      return;
    }
    try {
      const { blob, filename } = buildReportBlob(items);
      const outcome = await shareOrDownload(blob, filename);
      if (outcome === "shared") {
        toast.success("Отчёт отправлен", { description: filename });
      } else if (outcome === "downloaded") {
        toast.success("Отчёт сохранён в загрузки", { description: filename });
      }
    } catch {
      toast.error("Не удалось сформировать отчёт");
    }
  };

  const handleTemplate = () => {
    const blob = buildTemplateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Шаблон_учёта.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast.success("Шаблон скачан", {
      description: "Заполните колонки и импортируйте файл обратно.",
    });
  };

  const openAdd = () => {
    setEditItem(null);
    setPresetInv(undefined);
    setDialogOpen(true);
  };

  const openEdit = (item: InvItem) => {
    setEditItem(item);
    setPresetInv(undefined);
    setDialogOpen(true);
  };

  const tabLabel = (cat: string | null) => {
    const list =
      cat === null ? items : items.filter((i) => (i.category || "Прочее") === cat);
    const s = cat === null ? stats : statsForCategory(items, cat);
    return `${cat ?? "Все"} ${s.found}/${s.total}`;
  };

  return (
    <div className="app-shell flex min-h-screen flex-col bg-neutral-50">
      <PwaRegister />
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        aria-hidden
      />

      {/* ── Шапка ── */}
      <header className="sticky top-0 z-40 border-b bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
            <ListChecks className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight">
              Инвентаризация ПК
            </h1>
            <p className="text-xs text-muted-foreground">
              {stats.total} позиций · готовность {stats.pct}%
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Меню">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Импорт Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>
                <FileDown className="h-4 w-4" /> Скачать шаблон
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStickersOpen(true)}>
                <QrCode className="h-4 w-4" /> QR-наклейки для печати
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <Share2 className="h-4 w-4" /> Отчёт: экспорт / поделиться
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={loadDemo}>
                <Sparkles className="h-4 w-4" /> Загрузить демо-данные
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setResetOpen(true)} disabled={!items.length}>
                <RotateCcw className="h-4 w-4" /> Новая инвентаризация
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setClearOpen(true)}
                disabled={!items.length}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" /> Очистить список
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Прогресс */}
        <div className="mx-auto max-w-3xl px-3 pb-2">
          <div className="flex items-center gap-2">
            <Progress value={stats.pct} className="h-2 flex-1" />
            <div className="flex shrink-0 items-center gap-1.5 text-xs">
              <Badge variant="outline" className="gap-1 border-green-300 bg-green-50 text-green-700">
                <CheckCircle2 className="h-3 w-3" /> {stats.found}
              </Badge>
              <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
                <XCircle className="h-3 w-3" /> {stats.missing}
              </Badge>
              <Badge variant="outline" className="gap-1 text-neutral-500">
                <Clock className="h-3 w-3" /> {stats.unchecked}
              </Badge>
            </div>
          </div>
        </div>

        {/* Вкладки категорий */}
        <div className="mx-auto max-w-3xl overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1.5" role="tablist" aria-label="Категории">
            {[null, ...categories].map((cat) => {
              const key = cat ?? "all";
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  {tabLabel(cat)}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Список ── */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-40 pt-3">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по номеру, названию, описанию…"
            className="pl-9"
            aria-label="Поиск по списку"
          />
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
            <ListChecks className="mx-auto h-10 w-10 text-green-600/60" />
            <h2 className="mt-3 text-lg font-semibold">Список учёта пуст</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Импортируйте готовый Excel-файл (колонки: Категория, Инв.№,
              Название, Описание) или загрузите демо-данные, чтобы попробовать
              сканер.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => fileRef.current?.click()}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Upload className="h-4 w-4" /> Импорт Excel
              </Button>
              <Button variant="outline" onClick={loadDemo}>
                <Sparkles className="h-4 w-4" /> Демо-данные
              </Button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Ничего не найдено по запросу «{query}»
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((item, idx) => (
              <ItemCard
                key={item.id}
                item={item}
                index={idx}
                onToggle={() => togglePresent(item.id)}
                onMissing={() => markMissing(item.id)}
                onEdit={() => openEdit(item)}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </ul>
        )}
      </main>

      {/* ── Нижняя панель ── */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <Button
            onClick={() => setScanOpen(true)}
            className="h-12 flex-1 bg-green-600 text-base font-semibold text-white hover:bg-green-700"
            disabled={!items.length}
          >
            <ScanLine className="h-5 w-5" /> Сканировать QR
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12"
            onClick={openAdd}
            aria-label="Добавить позицию"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </footer>

      {/* ── Оверлеи и диалоги ── */}
      <ScanOverlay
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onManualAdd={(code) => {
          setEditItem(null);
          setPresetInv(code);
          setDialogOpen(true);
        }}
      />
      <StickersView open={stickersOpen} onClose={() => setStickersOpen(false)} />
      <ItemDialog
        open={dialogOpen}
        item={editItem}
        presetInventoryNumber={presetInv}
        onClose={() => setDialogOpen(false)}
      />

      {/* Удаление позиции */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить позицию?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `«${deleteTarget.name}» (${deleteTarget.inventoryNumber}) будет удалена из списка учёта.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) {
                  deleteItem(deleteTarget.id);
                  toast.success("Позиция удалена");
                }
                setDeleteTarget(null);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Новая инвентаризация */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Начать новую инвентаризацию?</AlertDialogTitle>
            <AlertDialogDescription>
              Все отметки «найдено/отсутствует» и время проверки будут сброшены.
              Сам список позиций останется.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                resetStatuses();
                setResetOpen(false);
                toast.success("Статусы сброшены — можно начинать");
              }}
            >
              Сбросить статусы
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Очистка списка */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Очистить весь список?</AlertDialogTitle>
            <AlertDialogDescription>
              Все позиции будут удалены безвозвратно. Вместо этого можно
              просто импортировать новый список с заменой.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                clearAll();
                setClearOpen(false);
                toast.success("Список очищен");
              }}
            >
              Очистить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Импорт: заменить или добавить */}
      <Dialog
        open={!!importState}
        onOpenChange={(v) => !v && setImportState(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Импорт из Excel</DialogTitle>
            <DialogDescription>
              Файл «{importState?.filename}»: найдено{" "}
              <b>{importState?.rows.length}</b> позиций. Как добавить их в
              список учёта?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                if (importState) importReplace(importState.rows);
                setImportState(null);
                toast.success(
                  `Список заменён: ${importState?.rows.length} позиций`
                );
              }}
            >
              Заменить текущий список
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (importState) importAppend(importState.rows);
                setImportState(null);
                toast.success("Позиции добавлены к списку");
              }}
            >
              Добавить к текущему списку
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setImportState(null)}
            >
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────── Карточка позиции ─────────────── */

function ItemCard({
  item,
  index,
  onToggle,
  onMissing,
  onEdit,
  onDelete,
}: {
  item: InvItem;
  index: number;
  onToggle: () => void;
  onMissing: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isFound = item.status === 1;
  const isMissing = item.status === 2;
  return (
    <li
      className={cn(
        "rounded-xl border p-3 shadow-sm transition-colors",
        isFound && "border-green-300 bg-green-50",
        isMissing && "border-red-200 bg-red-50",
        !isFound && !isMissing && "border-neutral-200 bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isFound}
          onCheckedChange={onToggle}
          className="mt-1"
          aria-label={`В наличии: ${item.name}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-bold">
              {item.inventoryNumber || "—"}
            </span>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[11px] text-neutral-500"
            >
              {item.category}
            </Badge>
            <span className="text-xs text-neutral-400">#{index + 1}</span>
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold">{item.name}</p>
          {item.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
              {item.description}
            </p>
          )}
          {item.scannedAt && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs",
                isFound ? "text-green-700" : "text-red-600"
              )}
            >
              {isFound ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {isFound ? "В наличии" : "Отсутствует"} ·{" "}
              {fmtDateTime(item.scannedAt)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
            aria-label="Редактировать"
          >
            <Pencil className="h-4 w-4 text-neutral-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMissing}
            aria-label={isMissing ? "Снять отметку отсутствия" : "Нет на месте"}
            title={isMissing ? "Снять отметку" : "Нет на месте"}
          >
            <CircleSlash
              className={cn(
                "h-4 w-4",
                isMissing ? "text-red-600" : "text-neutral-400"
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDelete}
            aria-label="Удалить"
          >
            <Trash2 className="h-4 w-4 text-neutral-400" />
          </Button>
        </div>
      </div>
    </li>
  );
}
