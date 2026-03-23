import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface AgentFrontmatter {
  name?: string;
  description?: string;
  color?: string;
  emoji?: string;
  vibe?: string;
}

function parseFrontmatter(content: string): { frontmatter: AgentFrontmatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, body: content };

  const fmLines = fmMatch[1].split("\n");
  const frontmatter: AgentFrontmatter = {};
  for (const line of fmLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, "");
    (frontmatter as Record<string, string>)[key] = value;
  }

  return { frontmatter, body: fmMatch[2].trim() };
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function loadAgentsFromDisk(): Promise<number> {
  // Try multiple paths: relative to source file (monorepo root), then process.cwd()
  const candidates = [
    resolve(__dirname, "../../../../agents"),   // from dist/src/lib/ → monorepo root
    resolve(__dirname, "../../../agents"),       // from src/lib/ → monorepo root
    join(process.cwd(), "agents"),               // fallback: cwd
  ];

  const agentsRoot = candidates.find((p) => existsSync(p));
  if (!agentsRoot) {
    return 0;
  }

  let count = 0;
  const categories = readdirSync(agentsRoot).filter((f) => {
    try {
      return statSync(join(agentsRoot, f)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const category of categories) {
    const categoryDir = join(agentsRoot, category);
    let files: string[] = [];
    try {
      files = readdirSync(categoryDir).filter((f) => f.endsWith(".md"));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = join(categoryDir, file);
      let content = "";
      try {
        content = readFileSync(filePath, "utf-8");
      } catch {
        continue;
      }

      const { frontmatter, body } = parseFrontmatter(content);
      const name = frontmatter.name || file.replace(".md", "").replace(/-/g, " ");
      const id = slugify(`${category}-${file.replace(".md", "")}`);

      try {
        const existing = db.select().from(agentsTable).where(eq(agentsTable.id, id)).get();

        const agentData = {
          id,
          name,
          category,
          description: frontmatter.description || body.slice(0, 300).replace(/^#.*\n/, "").trim(),
          color: frontmatter.color || null,
          emoji: frontmatter.emoji || null,
          vibe: frontmatter.vibe || null,
          systemPrompt: body,
          filePath,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        if (existing) {
          db.update(agentsTable)
            .set({
              name: agentData.name,
              description: agentData.description,
              color: agentData.color,
              emoji: agentData.emoji,
              vibe: agentData.vibe,
              systemPrompt: agentData.systemPrompt,
            })
            .where(eq(agentsTable.id, id))
            .run();
        } else {
          db.insert(agentsTable).values(agentData).run();
        }
        count++;
      } catch {
        // skip on error
      }
    }
  }

  return count;
}
