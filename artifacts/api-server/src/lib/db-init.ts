import { db, rawDb } from "@workspace/db";
import { runMigrations } from "@workspace/db/migrate";

/**
 * Initialize database:
 * 1. Enforce PRAGMA foreign_keys
 * 2. Try Drizzle migrations (if migrations/ folder exists)
 * 3. Fall back to raw SQL CREATE TABLE IF NOT EXISTS (safe for fresh DBs)
 */
export function initializeDatabase() {
  // Ensure foreign keys are enforced
  rawDb.pragma("foreign_keys = ON");

  // Try Drizzle migrations first
  try {
    const migrated = runMigrations();
    if (migrated) return; // migrations handled everything
  } catch {
    // Migration failed or no migrations folder — fall back to raw SQL
  }

  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT,
      emoji TEXT,
      vibe TEXT,
      system_prompt TEXT NOT NULL,
      file_path TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      model TEXT DEFAULT 'glm-5:cloud',
      ollama_endpoint TEXT DEFAULT 'http://localhost:11434',
      depends_on TEXT,
      auto_run INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS context (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'text/plain',
      content TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      language TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      transport_type TEXT NOT NULL DEFAULT 'stdio',
      command TEXT,
      args TEXT,
      url TEXT,
      env_vars TEXT,
      category TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      tools_cache TEXT,
      last_connected TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collaborations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      agents TEXT NOT NULL,
      pattern TEXT NOT NULL DEFAULT 'round-robin',
      max_rounds INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'pending',
      model TEXT DEFAULT 'glm-5:cloud',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collaboration_messages (
      id TEXT PRIMARY KEY,
      collaboration_id TEXT NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      agent_name TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      round INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      embedding TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      model TEXT NOT NULL DEFAULT 'nomic-embed-text',
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

