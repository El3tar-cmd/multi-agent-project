import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePlanProject, useListOllamaModels, useCreateProject, useCreateTask } from "@workspace/api-client-react";
import { Network, Search, Zap, Server, ChevronDown, CheckCircle2, Bot } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function OrchestratorPage() {
  const [taskDesc, setTaskDesc] = useState("");
  const [selectedModel, setSelectedModel] = useState("glm-5:cloud");
  
  const { data: modelsRes } = useListOllamaModels();
  const models = Array.isArray(modelsRes?.models) ? modelsRes.models : [];

  const { mutate: planProject, data: planData, isPending } = usePlanProject();

  const [, navigate] = useLocation();
  const { mutateAsync: createProject } = useCreateProject();
  const { mutateAsync: createTask } = useCreateTask();
  const [isCreating, setIsCreating] = useState(false);

  const handleSuggest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDesc.trim() || !selectedModel) return;
    planProject({ data: { prompt: taskDesc, model: selectedModel } });
  };

  const handleCreateProject = async () => {
    if (!planData?.tasks || planData.tasks.length === 0) return;
    setIsCreating(true);
    try {
      // 1. Create project
      const projectName = `AI Plan: ${taskDesc.substring(0, 30)}...`;
      const project = await createProject({ data: { name: projectName, description: taskDesc } });
      
      // 2. Create all tasks sequentially
      let order = 1;
      for (const task of planData.tasks) {
        await createTask({
          data: {
            projectId: project.id,
            title: `${order}. ${task.title}`,
            agentId: task.agentId,
            description: task.prompt, // Save generated prompt so it pre-fills the chat!
            model: selectedModel,
          }
        });
        order++;
      }
      
      // Navigate to the newly created project
      navigate(`/projects/${project.id}`);
    } catch (e) {
      console.error(e);
      alert("Failed to auto-create project and tasks.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="text-center mb-12 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/20 rounded-full blur-[100px] pointer-events-none"></div>
          <Network className="w-16 h-16 text-accent mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight">Smart <span className="text-accent text-glow">AI Planner</span></h1>
          <p className="text-muted-foreground mt-4 font-mono max-w-2xl mx-auto">
            Describe your full project idea. The AI Planner will break it down into sequential tasks, assigning the perfect specialized AI agent for each stage, and generating the exact prompt you need.
          </p>
        </div>

        <form onSubmit={handleSuggest} className="glass-panel p-2 flex flex-col md:flex-row gap-2 relative z-10 shadow-2xl items-center rounded-2xl">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="e.g. Build a React fullstack Memo App with Node.js and SQLite..." 
              className="w-full pl-12 pr-4 py-4 bg-transparent border-none focus:outline-none text-white text-lg placeholder:text-muted-foreground/50"
              required
            />
          </div>

          <div className="relative border-l border-white/10 pl-2 min-w-[200px] w-full md:w-auto mt-2 md:mt-0">
            <div className="flex items-center px-4 py-3 bg-black/40 rounded-xl cursor-not-allowed">
              <Server className="w-4 h-4 text-accent mr-2 shrink-0" />
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent border-none text-white text-sm focus:outline-none font-mono tracking-wider w-full appearance-none pr-8 cursor-pointer relative z-10"
              >
                {models.length > 0 ? (
                  models.map((model) => (
                    <option key={model.name} value={model.name} className="bg-background text-white">
                      {model.name}
                    </option>
                  ))
                ) : (
                  <option value="glm-5:cloud" className="bg-background">glm-5:cloud (Default)</option>
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-4 pointer-events-none" />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isPending || !taskDesc.trim()}
            className="flex items-center justify-center px-8 py-4 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 glow-primary w-full md:w-auto mt-2 md:mt-0"
          >
            {isPending ? (
              <div className="w-5 h-5 rounded-full border-t-2 border-white animate-spin"></div>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" /> Generate Plan
              </>
            )}
          </button>
        </form>

        {isPending && (
           <div className="mt-12 text-center animate-pulse">
             <Bot className="w-12 h-12 text-primary mx-auto mb-4 opacity-50 animate-bounce" />
             <p className="text-primary font-mono text-lg tracking-widest uppercase">Thinking & Compiling Project Plan...</p>
           </div>
        )}

        {planData?.tasks && planData.tasks.length > 0 && !isPending && (
          <div className="mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
            
            <div className="flex justify-between items-end mb-8">
              <div>
                <h3 className="text-2xl font-display font-bold text-white mb-2">Executed Master Plan</h3>
                <p className="text-muted-foreground font-mono text-sm">
                  Generated {planData.tasks.length} specialized task(s) for your project.
                </p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={handleCreateProject}
                  disabled={isCreating}
                  className="px-6 py-3 bg-accent hover:bg-accent/90 text-black rounded-lg font-bold transition-all disabled:opacity-50 flex items-center shadow-[0_0_15px_rgba(16,185,129,0.3)] glow-primary"
                >
                  {isCreating ? "Creating..." : "✨ Create Project & Add Tasks"}
                </button>
              </div>
            </div>

            <div className="relative border-l-2 border-primary/30 ml-4 md:ml-8 space-y-12 pb-12">
              {planData.tasks.map((task, index) => (
                <div key={index} className="relative pl-12 md:pl-16">
                  {/* Timeline Dot */}
                  <div className="absolute top-0 -left-[17px] w-8 h-8 rounded-full bg-black border-2 border-primary flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10">
                    <span className="text-primary font-bold text-sm bg-black rounded-full w-full h-full flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>

                  <div className="glass-panel p-8 rounded-3xl border-primary/20 relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-accent opacity-50"></div>
                    
                    <h2 className="text-2xl font-display font-bold text-white mb-4 group-hover:text-primary transition-colors">
                      {task.title}
                    </h2>
                    
                    <div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10">
                      <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-4 flex items-start">
                        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mr-4 shrink-0">
                          <Bot className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-mono text-muted-foreground uppercase mb-1">Assigned Agent</p>
                          <h4 className="text-lg font-bold text-white">{task.agentName}</h4>
                          <span className="text-xs text-muted-foreground font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/10 mt-1 inline-block">
                            ID: {task.agentId}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 bg-primary/5 border border-primary/20 rounded-2xl p-4">
                        <p className="text-xs font-mono text-primary uppercase mb-1 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Why this agent?
                        </p>
                        <p className="text-sm text-white/80 leading-relaxed font-sans">
                          {task.reason}
                        </p>
                      </div>
                    </div>

                    <div className="bg-black/80 rounded-2xl border border-white/10 p-5 relative group/prompt">
                      <p className="text-xs font-mono text-muted-foreground uppercase mb-3 px-2 flex justify-between items-center">
                        <span>📝 Use this exact Prompt:</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(task.prompt);
                            // could add toast here, simple effect for now
                          }}
                          className="hover:text-primary transition-colors flex items-center opacity-0 group-hover/prompt:opacity-100"
                        >
                          [Copy]
                        </button>
                      </p>
                      <div className="bg-[#0D1117] p-4 rounded-xl font-mono text-sm text-primary/90 leading-relaxed overflow-x-auto whitespace-pre-wrap border border-white/5">
                        {task.prompt}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
