import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const DEFAULT_ENDPOINT = "http://localhost:11434";

async function fetchOllama(endpoint: string, path: string, options?: RequestInit) {
  const url = `${endpoint.replace(/\/$/, "")}${path}`;
  return fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
}

router.get("/ollama/status", async (req, res) => {
  const endpoint = (req.query.endpoint as string) || DEFAULT_ENDPOINT;
  try {
    const r = await fetchOllama(endpoint, "/api/version");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as { version?: string };
    res.json({ connected: true, endpoint, version: data.version || "unknown" });
  } catch (err) {
    res.json({ connected: false, endpoint, message: String(err) });
  }
});

router.get("/ollama/models", async (req, res) => {
  const endpoint = (req.query.endpoint as string) || DEFAULT_ENDPOINT;
  try {
    const r = await fetchOllama(endpoint, "/api/tags");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as { models?: Array<{ name: string; size: number; modified_at: string }> };
    const models = (data.models || []).map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    }));
    res.json({ models, endpoint });
  } catch (err) {
    res.status(503).json({ error: "ollama_unavailable", message: String(err) });
  }
});

router.post("/ollama/chat", async (req: Request, res: Response) => {
  const {
    model = "glm-5:cloud",
    messages = [],
    systemPrompt,
    enableThinking = true,
    ollamaEndpoint = DEFAULT_ENDPOINT,
  } = req.body as {
    model?: string;
    messages?: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    enableThinking?: boolean;
    ollamaEndpoint?: string;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (type: string, payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  try {
    const allMessages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) allMessages.push({ role: "system", content: systemPrompt });
    allMessages.push(...messages);

    const body: Record<string, unknown> = {
      model,
      messages: allMessages,
      stream: true,
    };

    if (enableThinking) {
      body.think = true;
    }

    const r = await fetch(`${ollamaEndpoint.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!r.ok) {
      const errText = await r.text();
      sendEvent("error", { error: `Ollama error: ${r.status} ${errText}` });
      res.end();
      return;
    }

    const reader = r.body?.getReader();
    if (!reader) {
      sendEvent("error", { error: "No response body" });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as {
            message?: { content?: string; thinking?: string };
            done?: boolean;
          };

          if (chunk.message?.thinking) {
            sendEvent("thinking", { content: chunk.message.thinking });
          }
          if (chunk.message?.content) {
            sendEvent("content", { content: chunk.message.content });
          }
          if (chunk.done) {
            sendEvent("done", {});
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    if (!res.writableEnded) res.end();
  } catch (err) {
    sendEvent("error", { error: String(err) });
    if (!res.writableEnded) res.end();
  }
});

export default router;
