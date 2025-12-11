import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

const deployTarget = import.meta.env.VITE_DEPLOY_TARGET || 'spark'
if (deployTarget === 'spark') {
  await import("@github/spark/spark")
}

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { Toaster } from '@/components/ui/sonner'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
    <Toaster />
   </ErrorBoundary>
)
