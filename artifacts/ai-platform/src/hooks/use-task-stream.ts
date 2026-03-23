import { useState, useRef, useCallback } from "react";
import { RunTaskRequest } from "@workspace/api-client-react";

export type StreamState = {
  isStreaming: boolean;
  thinking: string;
  content: string;
  error: string | null;
  done: boolean;
};

// We use a custom fetch-based streaming hook because we need to send POST with body,
// and standard EventSource only supports GET.
export function useTaskStream() {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    thinking: "",
    content: "",
    error: null,
    done: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (taskId: string, payload: RunTaskRequest) => {
    // Reset state
    setState({
      isStreaming: true,
      thinking: "",
      content: "",
      error: null,
      done: false,
    });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/tasks/${taskId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body available for streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);
              
              if (event.type === "thinking") {
                setState((prev) => ({ ...prev, thinking: prev.thinking + event.content }));
              } else if (event.type === "content") {
                setState((prev) => ({ ...prev, content: prev.content + event.content }));
              } else if (event.type === "error") {
                setState((prev) => ({ ...prev, error: event.error, isStreaming: false, done: true }));
                break;
              } else if (event.type === "done") {
                setState((prev) => ({ ...prev, isStreaming: false, done: true }));
                break;
              }
            } catch (e) {
              console.error("Failed to parse SSE event:", dataStr, e);
            }
          }
        }
      }
      
      // Stream finished naturally — only set done if not already set by SSE event
      setState((prev) => {
        if (prev.done) return prev;
        return { ...prev, isStreaming: false, done: true };
      });

    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Stream aborted");
      } else {
        setState((prev) => ({ ...prev, error: err.message || "Stream failed", isStreaming: false, done: true }));
      }
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState((prev) => ({ ...prev, isStreaming: false }));
    }
  }, []);

  return {
    ...state,
    startStream,
    stopStream,
  };
}
