import type { NextConfig } from "next";

// Для GitHub Pages приложение живёт в подкаталоге /имя-репозитория/.
// Workflow передаёт путь через переменную NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Полностью статический экспорт: результат в папке out/
  output: "export",
  ...(basePath ? { basePath } : {}),
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
