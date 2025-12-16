import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import. meta.dirname

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins:  [
      react(),
      tailwindcss(),
      // DO NOT REMOVE
      createIconImportProxy() as PluginOption,
      // sparkPlugin() — УДАЛЁН для Bitrix-only сборки
    ],
    resolve:  {
      alias:  {
        '@':  resolve(projectRoot, 'src')
      }
    },
    build: {
      // Bitrix-friendly настройки
      rollupOptions: {
        output: {
          // Фиксированные имена файлов без хешей
          entryFileNames: 'assets/index.js',
          chunkFileNames:  'assets/[name].js',
          assetFileNames:  'assets/[name].[ext]'
        }
      },
      // Отключаем code splitting для единого бандла
      cssCodeSplit: false,
    }
  }
});
