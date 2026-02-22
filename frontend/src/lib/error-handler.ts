import type { ApiError } from './api-client'

/**
 * §61 Contract 3D — Frontend Error Mapping
 *
 * Converts any thrown error into a user-facing German message.
 * Used with toast.error(getErrorMessage(error)).
 */

export function getErrorMessage(error: unknown): string {
  // Structured backend error
  if (isApiError(error)) {
    return error.message ?? 'Ein Fehler ist aufgetreten.'
  }

  // Network/fetch failure
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Netzwerkfehler — bitte Internetverbindung prüfen.'
  }

  // AbortError (user cancelled)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Anfrage abgebrochen.'
  }

  // Timeout
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'Zeitüberschreitung — bitte erneut versuchen.'
  }

  // Generic Error with message
  if (error instanceof Error) {
    return error.message
  }

  return 'Ein unerwarteter Fehler ist aufgetreten.'
}

/**
 * Extract a machine-readable error code from an API error.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isApiError(error)) {
    return error.code
  }
  return undefined
}

/**
 * Type guard for ApiError shape.
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'status' in error
  )
}
