"use client";

import * as XLSX from "xlsx";
import { computeStats, type InvItem, type NewItemData, fmtDateTime } from "./inventory";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/* ─────────────── Импорт ─────────────── */

export interface ImportResult {
  rows: NewItemData[];
  sheetName: string;
  headerDetected: boolean;
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().trim();

/**
 * Читает первый лист xlsx: строка заголовков определяется автоматически,
 * колонки — по ключевым словам, иначе по позициям 1–4.
 */
export function parseWorkbook(buffer: ArrayBuffer): ImportResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], sheetName: "", headerDetected: false };
  const ws = wb.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (!grid.length) return { rows: [], sheetName, headerDetected: false };

  // Ищем строку заголовков: первая строка, где >= 2 непустых ячейек
  let headerIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const nonEmpty = grid[i].filter((c) => norm(c) !== "").length;
    if (nonEmpty >= 2) {
      headerIdx = i;
      break;
    }
  }

  let catIdx = 0;
  let invIdx = 1;
  let nameIdx = 2;
  let descIdx = 3;
  let headerDetected = false;
  let startRow = 0;

  if (headerIdx >= 0) {
    const header = grid[headerIdx].map(norm);
    const find = (...keys: string[]) =>
      header.findIndex((h) => keys.some((k) => h.includes(k)));
    const c = find("категор");
    // Приоритет: «Инв.№»/«Инвентарный» → «Номер» → одиночная «№»
    const iInv = header.findIndex((h) => h.includes("инв"));
    const iNum = header.findIndex((h) => h.includes("номер"));
    const iSharp = header.findIndex((h) => h === "№");
    const i = iInv !== -1 ? iInv : iNum !== -1 ? iNum : iSharp;
    const n = find("назван", "наименован", "модель", "оборудован", "позиция");
    const d = find("описан", "комплект", "конфигурац", "характеристик");
    if (i !== -1 && n !== -1 && i !== n) {
      catIdx = c;
      invIdx = i;
      nameIdx = n;
      descIdx = d;
      headerDetected = true;
    }
    startRow = headerIdx + 1;
  }

  const cell = (row: string[], idx: number) =>
    idx >= 0 && idx < row.length ? String(row[idx] ?? "").trim() : "";

  const rows: NewItemData[] = [];
  for (let r = startRow; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((c) => norm(c) === "")) continue;
    const inventoryNumber = cell(row, invIdx);
    const name = cell(row, nameIdx);
    if (!inventoryNumber && !name) continue;
    rows.push({
      category: cell(row, catIdx) || "Прочее",
      inventoryNumber,
      name,
      description: cell(row, descIdx),
    });
  }
  return { rows, sheetName, headerDetected };
}

/* ─────────────── Отчёт ─────────────── */

const STATUS_TEXT: Record<number, string> = {
  0: "— Не проверено",
  1: "✓ Найдено",
  2: "✗ Отсутствует",
};

export function buildReportBlob(items: InvItem[]): { blob: Blob; filename: string } {
  const now = new Date();
  const stats = computeStats(items);

  // Лист 1 — полный отчёт
  const reportAoa: (string | number)[][] = [
    ["№", "Категория", "Инв.№", "Название", "Описание", "Статус", "Время проверки"],
  ];
  items.forEach((it, i) => {
    reportAoa.push([
      i + 1,
      it.category,
      it.inventoryNumber,
      it.name,
      it.description,
      STATUS_TEXT[it.status] ?? STATUS_TEXT[0],
      it.scannedAt ? fmtDateTime(it.scannedAt) : "",
    ]);
  });
  const reportWs = XLSX.utils.aoa_to_sheet(reportAoa);
  reportWs["!cols"] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 12 },
    { wch: 26 },
    { wch: 48 },
    { wch: 15 },
    { wch: 17 },
  ];

  // Лист 2 — статистика
  const statAoa: (string | number)[][] = [
    ["Итоги инвентаризации"],
    ["Дата отчёта", fmtDateTime(now.getTime())],
    [],
    ["Показатель", "Значение"],
    ["Всего позиций", stats.total],
    ["Найдено", stats.found],
    ["Отсутствует", stats.missing],
    ["Не проверено", stats.unchecked],
    ["Готовность, %", stats.pct],
    [],
    ["Категория", "Всего", "Найдено", "Отсутствует", "Не проверено"],
  ];
  const cats: string[] = [];
  for (const it of items) {
    const c = it.category || "Прочее";
    if (!cats.includes(c)) cats.push(c);
  }
  for (const cat of cats) {
    const s = computeStats(items.filter((i) => (i.category || "Прочее") === cat));
    statAoa.push([cat, s.total, s.found, s.missing, s.unchecked]);
  }
  const statWs = XLSX.utils.aoa_to_sheet(statAoa);
  statWs["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 13 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, reportWs, "Отчёт");
  XLSX.utils.book_append_sheet(wb, statWs, "Статистика");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], { type: XLSX_MIME });
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const filename = `Инвентаризация_${stamp}.xlsx`;
  return { blob, filename };
}

/* ─────────────── Шаблон для импорта ─────────────── */

export function buildTemplateBlob(): Blob {
  const aoa: (string | number)[][] = [
    ["Категория", "Инв.№", "Название", "Описание"],
    ["Системные блоки", "PC-0001", "Системный блок №1", "i5-12400 / 16GB / SSD 512GB / RTX 3060"],
    ["Системные блоки", "PC-0002", "Системный блок №2", "Ryzen 5 5600 / 16GB / SSD 1TB"],
    ["Мониторы", "MN-0001", "Монитор Dell P2422H", '24" IPS, 1920×1080'],
    ["Клавиатуры", "KB-0001", "Logitech K120", "проводная, USB"],
    ["Мыши", "MS-0001", "Logitech B100", "проводная, USB"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 28 }, { wch: 44 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Учёт");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: XLSX_MIME });
}

/* ─────────────── Поделиться / скачать ─────────────── */

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/** Web Share API (Android: меню «Поделиться» → WhatsApp/почта и т.д.), иначе скачивание. */
export async function shareOrDownload(
  blob: Blob,
  filename: string
): Promise<ShareOutcome> {
  try {
    const file = new File([blob], filename, { type: XLSX_MIME });
    if (typeof navigator !== "undefined" && "canShare" in navigator) {
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
      };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Отчёт инвентаризации",
          text: "Excel-файл с результатами инвентаризации",
        });
        return "shared";
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled"; // пользователь закрыл меню «Поделиться»
    }
  }
  // Резервный путь: обычное скачивание
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
