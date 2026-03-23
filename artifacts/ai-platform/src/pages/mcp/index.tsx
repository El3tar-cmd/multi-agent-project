import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Server, Plug, PlugZap, Plus, Trash2, RefreshCw,
  Wrench, Globe, Terminal, Search, Wifi, WifiOff, X,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

interface McpServer {
  id: string;
  name: string;
  description: string | null;
  transportType: string;
  command: string | null;
  args: string[];
  url: string | null;
  category: string | null;
  isActive: number;
  connectionStatus: string;
  toolCount: number;
  toolsCache: any[];
  lastConnected: string | null;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Pre-built MCP server templates from awesome-mcp-servers
const MARKETPLACE_TEMPLATES = [
  { name: "Filesystem", description: "Read, write, and manage local files and directories", category: "file-system", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"] },
  { name: "GitHub", description: "Access GitHub repositories, issues, PRs, and more", category: "code", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
  { name: "Brave Search", description: "Web search via Brave Search API", category: "search", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"] },
  { name: "PostgreSQL", description: "Connect and query PostgreSQL databases", category: "database", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres"] },
  { name: "SQLite", description: "Query and manage SQLite databases", category: "database", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-sqlite"] },
  { name: "Puppeteer", description: "Browser automation and web scraping", category: "browser", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-puppeteer"] },
  { name: "Memory", description: "Knowledge graph-based persistent memory", category: "memory", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"] },
  { name: "Fetch", description: "HTTP fetch with robots.txt compliance", category: "web", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-fetch"] },
  { name: "Git", description: "Git repository operations and history", category: "code", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-git"] },
  { name: "Slack", description: "Send messages and manage Slack channels", category: "communication", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-slack"] },
  { name: "Google Maps", description: "Location services and directions", category: "location", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-google-maps"] },
  { name: "Sequential Thinking", description: "Dynamic problem-solving through sequential thought chains", category: "reasoning", transportType: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-sequential-thinking"] },
];

export default function McpMarketplacePage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTools, setSelectedTools] = useState<{ serverId: string; tools: McpTool[] } | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"installed" | "marketplace">("installed");
  const { toast } = useToast();

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/mcp/servers`);
      const data = await res.json();
      setServers(data.servers || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const installTemplate = async (template: typeof MARKETPLACE_TEMPLATES[0]) => {
    try {
      const res = await fetch(`${API}/mcp/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      if (res.ok) {
        toast({ title: "Installed", description: `${template.name} MCP server added` });
        fetchServers();
      }
    } catch {
      toast({ title: "Error", description: "Failed to install", variant: "destructive" });
    }
  };

  const connectServer = async (id: string) => {
    try {
      const res = await fetch(`${API}/mcp/servers/${id}/connect`, { method: "POST" });
      const data = await res.json();
      toast({
        title: data.status === "connected" ? "Connected" : "Connection Issue",
        description: data.status === "connected"
          ? `Discovered ${data.toolCount} tools`
          : data.error || "Could not connect",
        variant: data.status === "connected" ? "default" : "destructive",
      });
      fetchServers();
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    }
  };

  const deleteServer = async (id: string) => {
    try {
      await fetch(`${API}/mcp/servers/${id}`, { method: "DELETE" });
      toast({ title: "Removed", description: "MCP server removed" });
      fetchServers();
    } catch { /* ignore */ }
  };

  const viewTools = async (serverId: string) => {
    try {
      const res = await fetch(`${API}/mcp/servers/${serverId}/tools`);
      const data = await res.json();
      setSelectedTools({ serverId, tools: data.tools || [] });
    } catch { /* ignore */ }
  };

  const installedNames = new Set(servers.map((s) => s.name));
  const filteredTemplates = MARKETPLACE_TEMPLATES.filter(
    (t) => !installedNames.has(t.name) && (
      !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase())
    ),
  );

  const filteredServers = servers.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-white tracking-tight">
              MCP <span className="text-primary text-glow">Marketplace</span>
            </h1>
            <p className="text-muted-foreground mt-2 font-mono text-sm">
              Connect external tools via Model Context Protocol
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-lg text-sm font-mono text-primary transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Server
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-1">
          <button
            onClick={() => setTab("installed")}
            className={cn(
              "px-4 py-2 text-sm font-mono transition-all rounded-t-lg",
              tab === "installed" ? "bg-primary/20 text-primary border border-primary/30 border-b-0" : "text-muted-foreground hover:text-white",
            )}
          >
            <Server className="w-4 h-4 inline mr-2" />
            Installed ({servers.length})
          </button>
          <button
            onClick={() => setTab("marketplace")}
            className={cn(
              "px-4 py-2 text-sm font-mono transition-all rounded-t-lg",
              tab === "marketplace" ? "bg-primary/20 text-primary border border-primary/30 border-b-0" : "text-muted-foreground hover:text-white",
            )}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            Browse Marketplace
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-white placeholder:text-muted-foreground font-mono text-sm transition-all"
          />
        </div>

        {/* Installed Tab */}
        {tab === "installed" && (
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1,2,3].map((i) => (
                <div key={i} className="glass-panel h-48 rounded-2xl animate-pulse bg-secondary/20" />
              ))}
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="text-center py-20 glass-panel rounded-2xl border-dashed">
              <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-white">No MCP servers installed</h3>
              <p className="text-muted-foreground text-sm mt-1">Browse the marketplace to add servers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredServers.map((server) => (
                <div key={server.id} className="glass-panel rounded-2xl p-6 group hover:-translate-y-1 transition-all duration-300 hover:border-primary/30 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-2xl shadow-inner group-hover:border-primary/50 transition-all">
                      {server.transportType === "stdio" ? <Terminal className="w-6 h-6 text-primary" /> : <Globe className="w-6 h-6 text-blue-400" />}
                    </div>
                    <div className="flex items-center gap-2">
                      {server.connectionStatus === "connected" ? (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/20 text-xs font-mono text-emerald-400 border border-emerald-500/20">
                          <Wifi className="w-3 h-3" /> Connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-500/20 text-xs font-mono text-zinc-400 border border-zinc-500/20">
                          <WifiOff className="w-3 h-3" /> Offline
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1 font-display">{server.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2 flex-1">{server.description || "No description"}</p>

                  {server.category && (
                    <span className="self-start px-2 py-0.5 rounded bg-secondary/50 text-xs font-mono text-muted-foreground border border-white/5 uppercase mb-4">
                      {server.category}
                    </span>
                  )}

                  <div className="pt-4 border-t border-white/5 mt-auto flex items-center gap-2">
                    <button
                      onClick={() => connectServer(server.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-mono transition-all border border-primary/20"
                    >
                      <PlugZap className="w-3.5 h-3.5" />
                      {server.connectionStatus === "connected" ? "Reconnect" : "Connect"}
                    </button>
                    <button
                      onClick={() => viewTools(server.id)}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-white text-xs font-mono transition-all border border-white/10"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Tools {server.toolCount > 0 && `(${server.toolCount})`}
                    </button>
                    <button
                      onClick={() => deleteServer(server.id)}
                      className="flex items-center justify-center p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all border border-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Marketplace Tab */}
        {tab === "marketplace" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div key={template.name} className="glass-panel rounded-2xl p-6 group hover:-translate-y-1 transition-all duration-300 hover:border-primary/30 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center shadow-inner group-hover:border-primary/50 transition-all">
                    <Plug className="w-6 h-6 text-violet-400" />
                  </div>
                  <span className="px-2 py-1 rounded-md bg-secondary/50 text-xs font-mono text-muted-foreground border border-white/5 uppercase">
                    {template.category}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-1 font-display">{template.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{template.description}</p>

                <div className="pt-4 border-t border-white/5 mt-auto">
                  <button
                    onClick={() => installTemplate(template)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary font-mono text-sm transition-all border border-primary/30"
                  >
                    <Plus className="w-4 h-4" />
                    Install
                  </button>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <div className="col-span-full text-center py-16 glass-panel rounded-2xl">
                <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-white">All servers installed!</h3>
                <p className="text-muted-foreground text-sm mt-1">You have all available marketplace servers.</p>
              </div>
            )}
          </div>
        )}

        {/* Tools Modal */}
        {selectedTools && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTools(null)}>
            <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-display font-bold text-white">
                  <Wrench className="w-5 h-5 inline mr-2 text-primary" />
                  Available Tools
                </h2>
                <button onClick={() => setSelectedTools(null)} className="p-2 rounded-lg hover:bg-white/10 transition-all">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              {selectedTools.tools.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No tools discovered. Try connecting the server first.</p>
              ) : (
                <div className="space-y-3">
                  {selectedTools.tools.map((tool, i) => (
                    <div key={i} className="glass-panel rounded-xl p-4 border border-white/5">
                      <h4 className="font-mono text-sm font-bold text-primary">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Custom Server Modal */}
        {showAddModal && <AddServerModal onClose={() => setShowAddModal(false)} onAdded={fetchServers} />}
      </div>
    </AppLayout>
  );
}

function AddServerModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", transportType: "stdio", command: "", args: "", url: "", category: "" });
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description || undefined,
        transportType: form.transportType,
        category: form.category || undefined,
      };

      if (form.transportType === "stdio") {
        body.command = form.command;
        body.args = form.args ? form.args.split(" ") : [];
      } else {
        body.url = form.url;
      }

      const res = await fetch(`${API}/mcp/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: "Added", description: `${form.name} server registered` });
        onAdded();
        onClose();
      }
    } catch {
      toast({ title: "Error", description: "Failed to add server", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-display font-bold text-white">Add Custom MCP Server</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-all">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Server name" className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-primary" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-primary" />
          <select value={form.transportType} onChange={(e) => setForm({ ...form, transportType: e.target.value })} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-primary appearance-none">
            <option value="stdio">stdio (local command)</option>
            <option value="http">HTTP (remote server)</option>
            <option value="sse">SSE (remote server)</option>
          </select>

          {form.transportType === "stdio" ? (
            <>
              <input value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} placeholder="Command (e.g. npx, node, python)" className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-primary" />
              <input value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} placeholder="Args (space-separated)" className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-primary" />
            </>
          ) : (
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Server URL (e.g. http://localhost:3001)" className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-primary" />
          )}

          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category (e.g. file-system, code, search)" className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-primary" />

          <button onClick={handleSubmit} disabled={!form.name} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/80 text-white font-mono text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            Add Server
          </button>
        </div>
      </div>
    </div>
  );
}
