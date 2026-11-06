"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ─────────────── Типы ─────────────── */

export type ItemStatus = 0 | 1 | 2; // 0 — не проверено, 1 — найдено, 2 — отсутствует

export interface InvItem {
  id: string;
  category: string;
  inventoryNumber: string;
  name: string;
  description: string;
  status: ItemStatus;
  scannedAt: number | null;
  order: number; // порядок вставки
}

export interface NewItemData {
  category: string;
  inventoryNumber: string;
  name: string;
  description: string;
}

export type ScanOutcome = "found" | "already" | "not_found";

export interface ScanResult {
  outcome: ScanOutcome;
  code: string;
  item?: InvItem;
}

/* ─────────────── Утилиты ─────────────── */

let idCounter = 0;
function genId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Список категорий в порядке появления. */
export function getCategories(items: InvItem[]): string[] {
  const seen: string[] = [];
  for (const it of items) {
    const c = it.category || "Прочее";
    if (!seen.includes(c)) seen.push(c);
  }
  return seen;
}

/**
 * Порядок отображения: сначала непроверенные (в исходном порядке),
 * затем найденные (по времени проверки — свежие ближе к концу),
 * затем отсутствующие. Отсканированные «уезжают» в конец списка.
 */
export function sortForDisplay(items: InvItem[]): InvItem[] {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return a.status - b.status;
    if (a.status === 0) return a.order - b.order;
    const ta = a.scannedAt ?? 0;
    const tb = b.scannedAt ?? 0;
    if (ta !== tb) return ta - tb;
    return a.order - b.order;
  });
}

export interface Stats {
  total: number;
  found: number;
  missing: number;
  unchecked: number;
  pct: number;
}

export function computeStats(items: InvItem[]): Stats {
  const total = items.length;
  const found = items.filter((i) => i.status === 1).length;
  const missing = items.filter((i) => i.status === 2).length;
  const unchecked = items.filter((i) => i.status === 0).length;
  const pct = total ? Math.round((found / total) * 100) : 0;
  return { total, found, missing, unchecked, pct };
}

export function statsForCategory(items: InvItem[], category: string): Stats {
  return computeStats(items.filter((i) => (i.category || "Прочее") === category));
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─────────────── Демо-данные ─────────────── */

export const DEMO_ITEMS: NewItemData[] = [
  {
    category: "Системные блоки",
    inventoryNumber: "PC-0001",
    name: "Системный блок №1",
    description: "i5-12400 / 16GB DDR4 / SSD 512GB / RTX 3060 / корпус Zalman",
  },
  {
    category: "Системные блоки",
    inventoryNumber: "PC-0002",
    name: "Системный блок №2",
    description: "Ryzen 5 5600 / 16GB / SSD 1TB / GTX 1660 Super",
  },
  {
    category: "Системные блоки",
    inventoryNumber: "PC-0003",
    name: "Системный блок №3 (бухгалтерия)",
    description: "i3-10100 / 8GB / SSD 480GB / интегр. графика",
  },
  {
    category: "Системные блоки",
    inventoryNumber: "PC-0004",
    name: "Системный блок №4 (резерв)",
    description: "i7-9700 / 32GB / SSD 512 + HDD 2TB / RTX 2060",
  },
  {
    category: "Мониторы",
    inventoryNumber: "MN-0001",
    name: "Монитор Dell P2422H",
    description: '24" IPS, 1920×1080, HDMI+DP, к PC-0001',
  },
  {
    category: "Мониторы",
    inventoryNumber: "MN-0002",
    name: "Монитор AOC 24B2XH",
    description: '23.8" IPS, 1920×1080, HDMI, к PC-0002',
  },
  {
    category: "Мониторы",
    inventoryNumber: "MN-0003",
    name: "Монитор Samsung S27A600",
    description: '27" QHD, 2560×1440, к PC-0004',
  },
  {
    category: "Клавиатуры",
    inventoryNumber: "KB-0001",
    name: "Клавиатура Logitech K120",
    description: "Проводная, USB, чёрная",
  },
  {
    category: "Клавиатуры",
    inventoryNumber: "KB-0002",
    name: "Клавиатура Defender Accord",
    description: "Проводная, USB, мембранная",
  },
  {
    category: "Мыши",
    inventoryNumber: "MS-0001",
    name: "Мышь Logitech B100",
    description: "Проводная, USB, оптическая",
  },
  {
    category: "Мыши",
    inventoryNumber: "MS-0002",
    name: "Мышь Razer DeathAdder Essential",
    description: "Проводная, 6400 dpi, к PC-0004",
  },
  {
    category: "Прочее",
    inventoryNumber: "PR-0001",
    name: "Принтер HP LaserJet P1102",
    description: "Лазерный, монохромный, USB",
  },
  {
    category: "Прочее",
    inventoryNumber: "UP-0001",
    name: "ИБП Ippon Back Basic 650",
    description: "650 ВА, 4 розетки, к PC-0003",
  },
  {
    category: "Прочее",
    inventoryNumber: "SW-0001",
    name: "Коммутатор TP-Link TL-SG1024",
    description: "24 порта Gigabit, серверная",
  },
];

/* ─────────────── Хранилище ─────────────── */

interface InventoryState {
  items: InvItem[];
  activeTab: string; // "all" или название категории
  setActiveTab: (tab: string) => void;
  addItem: (data: NewItemData) => boolean; // false — дубликат инв.№
  updateItem: (id: string, data: NewItemData) => boolean;
  deleteItem: (id: string) => void;
  togglePresent: (id: string) => void; // галочка «в наличии»
  markMissing: (id: string) => void; // «нет на месте»
  scan: (code: string) => ScanResult;
  importReplace: (rows: NewItemData[]) => void;
  importAppend: (rows: NewItemData[]) => void;
  resetStatuses: () => void;
  loadDemo: () => void;
  clearAll: () => void;
}

export const useInventory = create<InventoryState>()(
  persist(
    (set, get) => ({
      items: [],
      activeTab: "all",

      setActiveTab: (tab) => set({ activeTab: tab }),

      addItem: (data) => {
        const inv = data.inventoryNumber.trim();
        const dup = get().items.some(
          (i) => i.inventoryNumber.toLowerCase() === inv.toLowerCase()
        );
        if (dup) return false;
        const order =
          get().items.reduce((m, i) => Math.max(m, i.order), 0) + 1;
        const item: InvItem = {
          id: genId(),
          category: data.category.trim() || "Прочее",
          inventoryNumber: inv,
          name: data.name.trim(),
          description: data.description.trim(),
          status: 0,
          scannedAt: null,
          order,
        };
        set({ items: [...get().items, item] });
        return true;
      },

      updateItem: (id, data) => {
        const items = get().items;
        const inv = data.inventoryNumber.trim();
        const dup = items.some(
          (i) =>
            i.id !== id && i.inventoryNumber.toLowerCase() === inv.toLowerCase()
        );
        if (dup) return false;
        set({
          items: items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  category: data.category.trim() || "Прочее",
                  inventoryNumber: inv,
                  name: data.name.trim(),
                  description: data.description.trim(),
                }
              : i
          ),
        });
        return true;
      },

      deleteItem: (id) =>
        set({ items: get().items.filter((i) => i.id !== id) }),

      togglePresent: (id) =>
        set({
          items: get().items.map((i) =>
            i.id === id
              ? i.status === 1
                ? { ...i, status: 0 as ItemStatus, scannedAt: null }
                : { ...i, status: 1 as ItemStatus, scannedAt: Date.now() }
              : i
          ),
        }),

      markMissing: (id) =>
        set({
          items: get().items.map((i) =>
            i.id === id
              ? i.status === 2
                ? { ...i, status: 0 as ItemStatus, scannedAt: null }
                : { ...i, status: 2 as ItemStatus, scannedAt: Date.now() }
              : i
          ),
        }),

      scan: (rawCode) => {
        const code = rawCode.trim();
        const item = get().items.find(
          (i) => i.inventoryNumber.toLowerCase() === code.toLowerCase()
        );
        if (!item) return { outcome: "not_found", code };
        if (item.status === 1) return { outcome: "already", code, item };
        const updated: InvItem = {
          ...item,
          status: 1,
          scannedAt: Date.now(),
        };
        set({
          items: get().items.map((i) => (i.id === item.id ? updated : i)),
        });
        return { outcome: "found", code, item: updated };
      },

      importReplace: (rows) => {
        const items: InvItem[] = rows.map((r, idx) => ({
          id: genId(),
          category: r.category.trim() || "Прочее",
          inventoryNumber: r.inventoryNumber.trim(),
          name: r.name.trim(),
          description: r.description.trim(),
          status: 0,
          scannedAt: null,
          order: idx,
        }));
        set({ items, activeTab: "all" });
      },

      importAppend: (rows) => {
        const base = get().items;
        const maxOrder = base.reduce((m, i) => Math.max(m, i.order), 0);
        let order = maxOrder;
        const existing = new Set(
          base.map((i) => i.inventoryNumber.toLowerCase())
        );
        const added: InvItem[] = [];
        for (const r of rows) {
          const inv = r.inventoryNumber.trim();
          if (!inv || existing.has(inv.toLowerCase())) continue; // пропускаем дубликаты
          order += 1;
          added.push({
            id: genId(),
            category: r.category.trim() || "Прочее",
            inventoryNumber: inv,
            name: r.name.trim(),
            description: r.description.trim(),
            status: 0,
            scannedAt: null,
            order,
          });
        }
        set({ items: [...base, ...added] });
      },

      resetStatuses: () =>
        set({
          items: get().items.map((i) => ({
            ...i,
            status: 0 as ItemStatus,
            scannedAt: null,
          })),
        }),

      loadDemo: () => get().importReplace(DEMO_ITEMS),

      clearAll: () => set({ items: [], activeTab: "all" }),
    }),
    {
      name: "pc-inventory-v1",
    }
  )
);
