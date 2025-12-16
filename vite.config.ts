import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path'
import { createIconImportProxy } from './src/lib/vite-phosphor-icon-proxy-plugin'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Local icon import proxy plugin (previously from @github/spark)
      createIconImportProxy(),
    ],
    resolve: {
      alias: {
        '@': resolve(projectRoot, 'src'),
        // Stub for @github/spark to prevent import errors
        '@github/spark': resolve(projectRoot, 'src/lib/spark-stub.ts'),
      }
    },
    build: {
      // Bitrix-friendly настройки
      rollupOptions: {
        output: {
          // Фиксированные имена файлов без хешей
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          // Отключить создание отдельных chunks
          manualChunks: undefined,
        },
        // Исключить @github/spark из бандла
        external: [],
      },
      // Единый бандл
      cssCodeSplit: false,
      // Инлайнить все модули
      modulePreload: false,
    },
    // Оптимизация - исключить spark
    optimizeDeps: {
      exclude: ['@github/spark']
    }
  }
});
