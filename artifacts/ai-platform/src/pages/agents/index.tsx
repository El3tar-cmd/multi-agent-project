import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useListAgents, useReloadAgents } from "@workspace/api-client-react";
import { Search, Bot, RefreshCw, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const { toast } = useToast();
  
  const { data, isLoading, refetch } = useListAgents({ search, category: category || undefined });
  const { mutate: reload, isPending: isReloading } = useReloadAgents({
    mutation: {
      onSuccess: (res) => {
        toast({
          title: "System Synced",
          description: `Successfully loaded ${res.loaded} agent configurations.`,
        });
        refetch();
      },
      onError: (err) => {
        toast({
          title: "Sync Failed",
          description: "Could not reload agents from the repository.",
          variant: "destructive"
        });
      }
    }
  });

  const categories = data?.categories || [];
  const agents = data?.agents || [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-white tracking-tight">Agent <span className="text-primary text-glow">Library</span></h1>
            <p className="text-muted-foreground mt-2 font-mono text-sm">Deploy specialized intelligence units.</p>
          </div>
          
          <button 
            onClick={() => reload()}
            disabled={isReloading}
            className="flex items-center px-4 py-2 bg-secondary hover:bg-secondary/80 border border-white/10 rounded-lg text-sm font-mono transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isReloading && "animate-spin")} />
            Sync Repository
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by name, capability..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-white placeholder:text-muted-foreground font-mono text-sm transition-all"
            />
          </div>
          <div className="relative w-full md:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-primary text-white font-mono text-sm appearance-none cursor-pointer"
            >
              <option value="">All Divisions</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="glass-panel h-48 rounded-2xl animate-pulse bg-secondary/20"></div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-2xl border-dashed">
            <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white">No agents found</h3>
            <p className="text-muted-foreground text-sm mt-1">Adjust search parameters or sync repository.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {agents.map(agent => (
              <div key={agent.id} className="glass-panel rounded-2xl p-6 group hover:-translate-y-1 transition-all duration-300 hover:border-primary/30 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-2xl shadow-inner group-hover:border-primary/50 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all">
                    {agent.emoji || "🤖"}
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-secondary/50 text-xs font-mono text-muted-foreground border border-white/5 uppercase">
                    {agent.category}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 font-display">{agent.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                  {agent.description}
                </p>
                
                <div className="pt-4 border-t border-white/5 mt-auto flex items-center justify-between">
                  <span className="text-xs italic text-primary/70 font-mono truncate mr-2">
                    {agent.vibe}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
