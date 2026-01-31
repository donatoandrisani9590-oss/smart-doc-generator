import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CountryProvider } from '@/hooks/useCountry'
import { ToastProvider } from '@/components/ui/toast'
import { UndoProvider } from '@/hooks/useUndo'
import { OnlineStatusProvider } from '@/hooks/useOnlineStatus'
import { ErrorHandlerProvider } from '@/hooks/useErrorHandler'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { logError, logInfo } from '@/lib/logger'
import './index.css'
import App from './App.tsx'

// Log app initialization
logInfo('App initializing', {
  environment: import.meta.env.MODE,
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
})

// Create a client with error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Global error handler for queries
      throwOnError: false,
    },
    mutations: {
      // Log mutation errors globally
      onError: (error) => {
        logError('Mutation failed', { error: String(error) })
      },
    },
  },
})

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection', {
    reason: String(event.reason),
    stack: event.reason?.stack,
  })
})

// Global error handler for runtime errors
window.addEventListener('error', (event) => {
  logError('Uncaught error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logError('Root ErrorBoundary caught error', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        })
      }}
    >
      <QueryClientProvider client={queryClient}>
        <OnlineStatusProvider>
          <CountryProvider>
            <ToastProvider>
              <ErrorHandlerProvider>
                <UndoProvider>
                  <App />
                </UndoProvider>
              </ErrorHandlerProvider>
            </ToastProvider>
          </CountryProvider>
        </OnlineStatusProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
