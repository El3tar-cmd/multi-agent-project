import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetOllamaStatus, useListOllamaModels } from "@workspace/api-client-react";
import { Settings, Server, HardDrive, ShieldCheck, Database } from "lucide-react";

export default function SettingsPage() {
  const [endpoint, setEndpoint] = useState("http://localhost:11434");
  
  const { data: status, refetch: checkStatus, isFetching: checking } = useGetOllamaStatus({ endpoint });
  const { data: models } = useListOllamaModels({ endpoint });

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl">
        <div>
          <h1 className="text-4xl font-display font-bold text-white tracking-tight">System <span className="text-primary text-glow">Configuration</span></h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Manage local LLM connections and orchestration settings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 space-y-6">
            {/* Ollama Config */}
            <div className="glass-panel p-8 rounded-2xl relative overflow-hidden border-primary/20">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary glow-primary"></div>
              
              <div className="flex items-center mb-6">
                <Server className="w-6 h-6 text-primary mr-3" />
                <h2 className="text-xl font-display font-bold text-white">Local Inference Engine</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase mb-2">Ollama API Endpoint</label>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-primary text-white font-mono text-sm"
                    />
                    <button 
                      onClick={() => checkStatus()}
                      disabled={checking}
                      className="px-6 py-3 bg-secondary hover:bg-secondary/80 border border-white/10 rounded-xl font-medium transition-all"
                    >
                      {checking ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium mb-1">Connection Status</h4>
                    <p className="text-xs text-muted-foreground">
                      {status?.connected ? `Connected to Ollama v${status.version}` : (status?.message || "Not connected")}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-mono border ${status?.connected ? "bg-primary/10 text-primary border-primary/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                    {status?.connected ? "ONLINE" : "OFFLINE"}
                  </div>
                </div>
              </div>
            </div>

            {/* Available Models */}
            <div className="glass-panel p-8 rounded-2xl">
              <div className="flex items-center mb-6">
                <Database className="w-6 h-6 text-white mr-3" />
                <h2 className="text-xl font-display font-bold text-white">Installed Models</h2>
              </div>
              
              {models?.models && models.models.length > 0 ? (
                <div className="space-y-3">
                  {models.models.map((model) => (
                    <div key={model.name} className="p-4 rounded-xl border border-white/5 bg-black/20 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center">
                        <HardDrive className="w-4 h-4 text-muted-foreground mr-3" />
                        <span className="font-mono text-sm text-white font-bold">{model.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {(model.size / (1024 * 1024 * 1024)).toFixed(1)} GB
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono">
                  No models found or engine offline. Use `ollama run llama3.2:3b` in your terminal to install a model.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border-white/5">
              <ShieldCheck className="w-8 h-8 text-accent mb-4" />
              <h3 className="font-bold text-white mb-2">Privacy Focus</h3>
              <p className="text-sm text-muted-foreground">
                All inference is run locally on your hardware. No data is sent to external APIs like OpenAI or Anthropic. Your project context remains entirely on your machine.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-[url('/images/hacker-bg.png')] bg-cover bg-center border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
              <div className="relative z-10">
                <h3 className="font-mono text-primary font-bold text-sm uppercase tracking-wider mb-2">System Specs</h3>
                <ul className="space-y-2 text-xs font-mono text-white/70">
                  <li className="flex justify-between"><span>Architecture:</span> <span className="text-white">Orchestrator v1</span></li>
                  <li className="flex justify-between"><span>Agents Loaded:</span> <span className="text-white">Active</span></li>
                  <li className="flex justify-between"><span>Memory:</span> <span className="text-white">SQLite local</span></li>
                  <li className="flex justify-between"><span>UI:</span> <span className="text-white">React / Vite</span></li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
