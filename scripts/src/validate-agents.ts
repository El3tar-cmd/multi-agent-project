import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface AgentFrontmatter {
  name?: string;
  description?: string;
  color?: string;
  emoji?: string;
  vibe?: string;
}

interface AgentIssue {
  filePath: string;
  issue: string;
}

function parseFrontmatter(content: string): { frontmatter: AgentFrontmatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, body: content.trim() };

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

function getAgentFiles(agentsRoot: string): string[] {
  const categories = readdirSync(agentsRoot).filter((entry) => {
    try {
      return statSync(join(agentsRoot, entry)).isDirectory();
    } catch {
      return false;
    }
  });

  const files: string[] = [];
  for (const category of categories) {
    const categoryDir = join(agentsRoot, category);
    const markdownFiles = readdirSync(categoryDir).filter(
      (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md",
    );
    for (const markdownFile of markdownFiles) {
      files.push(join(categoryDir, markdownFile));
    }
  }
  return files;
}

function main(): void {
  const agentsRootCandidates = [join(process.cwd(), "agents"), join(process.cwd(), "..", "agents")];
  const agentsRoot = agentsRootCandidates.find((candidate) => {
    try {
      return statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  });

  if (!agentsRoot) {
    console.error("❌ Could not locate agents directory.");
    process.exit(1);
  }

  const repoRoot = agentsRoot.replace(/\/agents$/, "");
  const files = getAgentFiles(agentsRoot);
  const issues: AgentIssue[] = [];
  const seenIds = new Map<string, string>();

  for (const filePath of files) {
    const relativePath = filePath.replace(`${repoRoot}/`, "");
    const content = readFileSync(filePath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);

    if (!frontmatter.name?.trim()) {
      issues.push({ filePath: relativePath, issue: "missing frontmatter field: name" });
    }

    if (!frontmatter.description?.trim()) {
      issues.push({ filePath: relativePath, issue: "missing frontmatter field: description" });
    }

    if (!body.trim()) {
      issues.push({ filePath: relativePath, issue: "empty system prompt body" });
    }

    const category = relativePath.split("/")[1] ?? "";
    const fileStem = relativePath.split("/").pop()?.replace(".md", "") ?? "";
    const id = slugify(`${category}-${fileStem}`);

    const collisionPath = seenIds.get(id);
    if (collisionPath) {
      issues.push({
        filePath: relativePath,
        issue: `duplicate generated id "${id}" (also from ${collisionPath})`,
      });
    } else {
      seenIds.set(id, relativePath);
    }
  }

  if (issues.length > 0) {
    console.error(`❌ Agent validation failed with ${issues.length} issue(s):`);
    for (const issue of issues) {
      console.error(`- ${issue.filePath}: ${issue.issue}`);
    }
    process.exit(1);
  }

  console.log(`✅ Agent validation passed for ${files.length} file(s).`);
  console.log(`✅ Generated IDs are unique (${seenIds.size} total).`);
}

main();
