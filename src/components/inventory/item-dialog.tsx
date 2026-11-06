"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInventory, type InvItem } from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface ItemDialogProps {
  open: boolean;
  /** null — добавление, иначе редактирование позиции */
  item: InvItem | null;
  /** Предзаполненный инв.№ (например, из ненайденного QR) */
  presetInventoryNumber?: string;
  presetCategory?: string;
  onClose: () => void;
}

export function ItemDialog({
  open,
  item,
  presetInventoryNumber,
  presetCategory,
  onClose,
}: ItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <ItemForm
            key={`${item?.id ?? "new"}-${presetInventoryNumber ?? ""}`}
            item={item}
            presetInventoryNumber={presetInventoryNumber}
            presetCategory={presetCategory}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({
  item,
  presetInventoryNumber,
  presetCategory,
  onClose,
}: {
  item: InvItem | null;
  presetInventoryNumber?: string;
  presetCategory?: string;
  onClose: () => void;
}) {
  const items = useInventory((s) => s.items);
  const addItem = useInventory((s) => s.addItem);
  const updateItem = useInventory((s) => s.updateItem);

  const categories = useMemo(() => {
    const set: string[] = [];
    for (const it of items) {
      const c = it.category || "Прочее";
      if (!set.includes(c)) set.push(c);
    }
    if (presetCategory && !set.includes(presetCategory)) set.push(presetCategory);
    return set;
  }, [items, presetCategory]);

  const [category, setCategory] = useState(
    item?.category ?? presetCategory ?? ""
  );
  const [inventoryNumber, setInventoryNumber] = useState(
    item?.inventoryNumber ?? presetInventoryNumber ?? ""
  );
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [errorText, setErrorText] = useState<string | null>(null);

  const submit = () => {
    if (!inventoryNumber.trim() && !name.trim()) {
      setErrorText("Укажите инвентарный номер или название позиции.");
      return;
    }
    const data = {
      category: category.trim() || "Прочее",
      inventoryNumber: inventoryNumber.trim(),
      name: name.trim(),
      description: description.trim(),
    };
    const ok = item ? updateItem(item.id, data) : addItem(data);
    if (!ok) {
      setErrorText(
        `Позиция с инв. № «${inventoryNumber.trim()}» уже есть в списке.`
      );
      return;
    }
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {item ? "Редактировать позицию" : "Новая позиция"}
        </DialogTitle>
        <DialogDescription>
          {item
            ? "Измените данные позиции учёта."
            : "Заполните карточку техники или комплектующего."}
        </DialogDescription>
      </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="it-cat">Категория (вкладка)</Label>
            <Input
              id="it-cat"
              list="it-cat-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Системные блоки, Мониторы, Клавиатуры…"
            />
            <datalist id="it-cat-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="it-inv">Инвентарный № (содержимое QR)</Label>
            <Input
              id="it-inv"
              value={inventoryNumber}
              onChange={(e) => setInventoryNumber(e.target.value)}
              placeholder="PC-0001"
              className={cn("font-mono")}
              autoCapitalize="characters"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="it-name">Название</Label>
            <Input
              id="it-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Системный блок №1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="it-desc">Описание комплектующих</Label>
            <Textarea
              id="it-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="i5-12400 / 16GB / SSD 512GB / RTX 3060"
              rows={3}
            />
          </div>
          {errorText && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorText}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={submit}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {item ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
    </>
  );
}
