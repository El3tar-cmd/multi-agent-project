import { AppLayout } from "@/components/layout/app-layout";
import { useListAgents, useListProjects, useGetOllamaStatus } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Activity, Bot, FolderKanban, ArrowRight, Zap, Database } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: agentsRes, isLoading: loadingAgents } = useListAgents();
  const { data: projectsRes, isLoading: loadingProjects } = useListProjects();
  const { data: ollamaRes } = useGetOllamaStatus();

  const activeProjects = projectsRes?.projects?.slice(0, 3) || [];
  const agents = agentsRes?.agents || [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-white tracking-tight">System <span className="text-primary text-glow">Overview</span></h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Monitoring multi-agent orchestration grid.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-primary/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <span className="text-4xl font-display font-bold text-white">{loadingAgents ? "-" : agents.length}</span>
            </div>
            <h3 className="font-medium text-muted-foreground uppercase tracking-wider text-xs font-mono">Available Agents</h3>
          </div>

          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-accent/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-accent/10 rounded-full blur-2xl group-hover:bg-accent/20 transition-colors"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-accent/10 rounded-xl border border-accent/20">
                <FolderKanban className="w-6 h-6 text-accent" />
              </div>
              <span className="text-4xl font-display font-bold text-white">{loadingProjects ? "-" : projectsRes?.projects?.length || 0}</span>
            </div>
            <h3 className="font-medium text-muted-foreground uppercase tracking-wider text-xs font-mono">Active Projects</h3>
          </div>

          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-secondary rounded-xl border border-white/5">
                <Database className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono text-muted-foreground uppercase">Ollama</span>
                <div className={`w-3 h-3 rounded-full ${ollamaRes?.connected ? "bg-primary animate-pulse glow-primary" : "bg-destructive"} `}></div>
              </div>
            </div>
            <h3 className="font-medium text-white">
              {ollamaRes?.connected ? "Engine Online" : "Engine Offline"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{ollamaRes?.version || "Awaiting connection"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Projects */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-display font-bold flex items-center">
                <Activity className="w-5 h-5 mr-2 text-primary" /> Active Projects
              </h2>
              <Link href="/projects" className="text-sm text-primary hover:text-white transition-colors font-mono uppercase tracking-wider">View All</Link>
            </div>
            
            <div className="space-y-4">
              {loadingProjects ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary/50 rounded-xl"></div>)}
                </div>
              ) : activeProjects.length > 0 ? (
                activeProjects.map(project => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="block">
                    <div className="p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-secondary hover:border-primary/30 transition-all group flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-white group-hover:text-primary transition-colors">{project.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{project.description || "No description"}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-white/10 rounded-xl">
                  No active projects found.
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions / Getting Started */}
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
            <img src={`${import.meta.env.BASE_URL}images/brain-core.png`} alt="AI Brain" className="absolute right-[-20%] bottom-[-20%] w-64 opacity-20 pointer-events-none mix-blend-screen" />
            <h2 className="text-xl font-display font-bold flex items-center mb-6 relative z-10">
              <Zap className="w-5 h-5 mr-2 text-accent" /> Quick Launch
            </h2>
            
            <div className="space-y-4 relative z-10">
              <Link href="/orchestrator" className="block p-5 rounded-xl bg-gradient-to-r from-accent/20 to-transparent border border-accent/20 hover:border-accent/50 transition-all group">
                <h4 className="font-bold text-white group-hover:text-glow">Smart Orchestrator</h4>
                <p className="text-sm text-muted-foreground mt-1">Describe a task and let the system route it to the optimal agent.</p>
              </Link>
              
              <Link href="/agents" className="block p-5 rounded-xl bg-secondary/50 border border-white/5 hover:border-white/20 transition-all group">
                <h4 className="font-bold text-white group-hover:text-primary">Browse Agent Library</h4>
                <p className="text-sm text-muted-foreground mt-1">Explore {agents.length} specialized AI agents ready for deployment.</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
