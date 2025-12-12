import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isBitrixMode = mode === 'bitrix' || process.env.VITE_DEPLOY_TARGET === 'bitrix'
  
  console.log(`[Vite Config] Build mode: ${isBitrixMode ? 'BITRIX' : 'DEMO'}`)
  
  return {
    plugins: [
      react(),
      tailwindcss(),
      // DO NOT REMOVE
      createIconImportProxy() as PluginOption,
      sparkPlugin() as PluginOption,
    ],
    resolve: {
      alias: {
        '@': resolve(projectRoot, 'src')
      }
    },
    define: {
      // Явно определяем для runtime
      'import.meta.env.VITE_DEPLOY_TARGET': JSON.stringify(
        isBitrixMode ? 'bitrix' : 'spark'
      )
    }
  }
});
