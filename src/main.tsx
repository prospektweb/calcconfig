import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { Toaster } from '@/components/ui/sonner'
import { BitrixProvider } from '@/contexts/BitrixContext'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <BitrixProvider>
      <App />
      <Toaster />
    </BitrixProvider>
  </ErrorBoundary>
)
