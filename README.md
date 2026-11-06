# Инвентаризация ПК — PWA

Офлайн-приложение (Next.js + TypeScript + Tailwind) для инвентаризации компьютерной
техники по QR-кодам: список с вкладками-категориями, сканирование камерой,
импорт/экспорт Excel, печать QR-наклеек. Данные хранятся только в браузере
(localStorage), сервер не нужен.

## Локальный запуск

```bash
bun install      # или npm install
bun run dev      # http://localhost:3000
```

## Автосборка на GitHub

Workflow `.github/workflows/pages.yml` при каждом push в `main`/`master`:

1. собирает статическую версию (`next build` с `output: "export"`);
2. публикует её на **GitHub Pages**.

Адрес сайта: `https://<ваш-логин>.github.io/<имя-репозитория>/`.
Для репозитория `<логин>.github.io` basePath определяется автоматически.

Разовая настройка после первого пуша: **Settings → Pages → Source =
GitHub Actions** (если не включилось само) — затем перезапустите workflow
(вкладка Actions → Deploy PWA to GitHub Pages → Run workflow).

## Структура

```
src/components/inventory/   — интерфейс приложения (список, сканер, наклейки)
src/lib/inventory.ts        — хранилище zustand + persist (localStorage)
src/lib/xlsx-ops.ts         — импорт/экспорт Excel (SheetJS)
public/sw.js, manifest.json — офлайн-режим (PWA)
.github/workflows/pages.yml — автосборка и деплой на GitHub Pages
```
