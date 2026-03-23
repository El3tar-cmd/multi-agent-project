import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger.js";

interface WsClient {
  ws: WebSocket;
  subscriptions: Set<string>; // e.g "project:123", "task:456", "all"
}

/**
 * Real-time event system via WebSocket.
 * 
 * Clients connect to ws://host:port/ws and can subscribe to channels:
 * - "all" — receive all events
 * - "project:<id>" — events for a specific project
 * - "task:<id>" — events for a specific task
 * 
 * Server pushes events for:
 * - Task status changes
 * - New messages (streaming)
 * - Collaboration updates
 * - Agent activity
 * - System health changes
 */
class RealtimeManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WsClient>();

  /**
   * Attach WebSocket server to an existing HTTP server
   */
  attach(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket) => {
      const client: WsClient = { ws, subscriptions: new Set(["all"]) };
      this.clients.add(client);

      logger.info({ clientCount: this.clients.size }, "WebSocket client connected");

      ws.on("message", (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(client, msg);
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        }
      });

      ws.on("close", () => {
        this.clients.delete(client);
        logger.info({ clientCount: this.clients.size }, "WebSocket client disconnected");
      });

      ws.on("error", (err: Error) => {
        logger.error({ err }, "WebSocket client error");
        this.clients.delete(client);
      });

      // Send welcome
      ws.send(JSON.stringify({
        type: "connected",
        message: "Connected to Multi-Agent Platform real-time feed",
        timestamp: new Date().toISOString(),
      }));
    });

    logger.info("WebSocket server attached at /ws");
  }

  /**
   * Handle incoming client messages (subscribe/unsubscribe)
   */
  private handleMessage(client: WsClient, msg: { action: string; channel?: string }) {
    switch (msg.action) {
      case "subscribe":
        if (msg.channel) {
          client.subscriptions.add(msg.channel);
          client.ws.send(JSON.stringify({ type: "subscribed", channel: msg.channel }));
        }
        break;
      case "unsubscribe":
        if (msg.channel) {
          client.subscriptions.delete(msg.channel);
          client.ws.send(JSON.stringify({ type: "unsubscribed", channel: msg.channel }));
        }
        break;
      case "ping":
        client.ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
        break;
    }
  }

  /**
   * Broadcast an event to matching clients.
   * channels: array of channels this event belongs to (e.g ["project:abc", "task:xyz"])
   */
  broadcast(event: { type: string; [key: string]: unknown }, channels: string[] = []) {
    const payload = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // Check if client is subscribed to any matching channel
      const shouldSend = client.subscriptions.has("all") ||
        channels.some((ch) => client.subscriptions.has(ch));

      if (shouldSend) {
        client.ws.send(payload);
      }
    }
  }

  // ---------- Convenience event emitters ----------

  taskStatusChanged(taskId: string, projectId: string, status: string, title: string) {
    this.broadcast(
      { type: "task:status", taskId, projectId, status, title },
      [`project:${projectId}`, `task:${taskId}`],
    );
  }

  taskMessage(taskId: string, projectId: string, role: string, content: string) {
    this.broadcast(
      { type: "task:message", taskId, projectId, role, content: content.substring(0, 500) },
      [`project:${projectId}`, `task:${taskId}`],
    );
  }

  collaborationUpdate(collaborationId: string, projectId: string, agentName: string, round: number) {
    this.broadcast(
      { type: "collaboration:update", collaborationId, projectId, agentName, round },
      [`project:${projectId}`, `collaboration:${collaborationId}`],
    );
  }

  artifactCreated(artifactId: string, projectId: string, filename: string) {
    this.broadcast(
      { type: "artifact:created", artifactId, projectId, filename },
      [`project:${projectId}`],
    );
  }

  systemEvent(event: string, data?: Record<string, unknown>) {
    this.broadcast({ type: `system:${event}`, ...data });
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      subscriptions: Array.from(this.clients).map((c) => ({
        channels: Array.from(c.subscriptions),
      })),
    };
  }
}

// Singleton
export const realtimeManager = new RealtimeManager();
