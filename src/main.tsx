import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

// Note: @github/spark dependency has been removed
// The app now works standalone without spark runtime

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { Toaster } from '@/components/ui/sonner'
import { DragProvider } from '@/contexts/DragContext'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <DragProvider>
      <App />
      <Toaster />
    </DragProvider>
   </ErrorBoundary>
)
