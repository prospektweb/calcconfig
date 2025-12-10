import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // БЕЗ sparkPlugin и createIconImportProxy
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  base: './',  // Важно для относительных путей в iframe
});
