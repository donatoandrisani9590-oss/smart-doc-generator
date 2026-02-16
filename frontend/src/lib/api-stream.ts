/**
 * SSE Stream Utility for AI streaming endpoints.
 *
 * Uses POST + ReadableStream (not EventSource) because we need:
 * - POST method with JSON body
 * - Authorization headers
 * - Token refresh support via apiFetch()
 */

import { apiFetch, type ApiError } from "./api-client";

/** Generic SSE event frame from the streaming endpoint. */
export interface SSEEvent {
  // Existing (text streaming — refine, draft, chat)
  token?: string;
  done?: boolean;
  provider?: string;
  changes_summary?: string;
  error?: string;

  // Agent events (Phase 0 prep, used in Phase 1+2)
  type?: "text_delta" | "thinking" | "tool_start" | "tool_result"
       | "form_update" | "clause_update" | "clause_draft"
       | "preview_ready" | "done" | "error";
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  fields?: Record<string, string>;
  enable?: number[];
  disable?: number[];
  title?: string;
  html?: string;
  summary?: string;
  latency_ms?: number;
  requires_confirmation?: boolean;
}

/**
 * Stream SSE events from a POST endpoint.
 *
 * @param endpoint - API path (e.g., "/api/v1/smart/refine/stream")
 * @param body - JSON request body
 * @param signal - Optional AbortSignal for cancellation
 * @yields Parsed SSE event objects
 */
export async function* apiStreamSSE(
  endpoint: string,
  body: unknown,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const response = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      message = errorBody.detail || errorBody.message || message;
    } catch {
      // ignore parse failure
    }
    const error: ApiError = { message, status: response.status };
    throw error;
  }

  if (!response.body) {
    throw new Error("Response body is not available for streaming");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE frames (delimited by double newline)
      const frames = buffer.split("\n\n");
      // Keep the last incomplete frame in the buffer
      buffer = frames.pop() || "";

      for (const frame of frames) {
        const trimmed = frame.trim();
        if (!trimmed) continue;

        // Parse each line in the frame
        for (const line of trimmed.split("\n")) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const event: SSEEvent = JSON.parse(dataStr);
              yield event;
            } catch {
              // Skip malformed JSON
              continue;
            }
          }
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      for (const line of buffer.trim().split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            yield event;
          } catch {
            // Skip malformed
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
