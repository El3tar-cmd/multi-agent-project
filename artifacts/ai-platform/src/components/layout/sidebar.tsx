import { Link, useLocation } from "wouter";
import { 
  Terminal, 
  LayoutDashboard, 
  Bot, 
  FolderKanban, 
  Network, 
  Settings, 
  History
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agent Library", icon: Bot },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/orchestrator", label: "Orchestrator", icon: Network },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-xl hidden md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-border/50">
        <Terminal className="w-6 h-6 text-primary mr-3" />
        <span className="font-display font-bold text-lg tracking-tight text-white text-glow">NEXUS<span className="text-primary">.AI</span></span>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        <div className="px-3 mb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
          System Core
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20 glow-primary" 
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:border hover:border-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5 mr-3 transition-colors duration-200", isActive ? "text-primary" : "group-hover:text-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse mr-3 glow-primary"></div>
          <div className="flex flex-col">
            <span className="text-xs font-mono text-foreground">System Online</span>
            <span className="text-[10px] text-muted-foreground">Ollama Local LLM</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
