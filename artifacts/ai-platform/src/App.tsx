import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Page Imports
import Dashboard from "@/pages/dashboard";
import AgentsPage from "@/pages/agents/index";
import ProjectsPage from "@/pages/projects/index";
import ProjectDetail from "@/pages/projects/detail";
import TaskChat from "@/pages/tasks/chat";
import OrchestratorPage from "@/pages/orchestrator/index";
import SettingsPage from "@/pages/settings/index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
    }
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agents" component={AgentsPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/projects/:projectId/tasks/:taskId" component={TaskChat} />
      <Route path="/orchestrator" component={OrchestratorPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
