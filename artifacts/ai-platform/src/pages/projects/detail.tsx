import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetProject, useListProjectTasks, useGetProjectContext, useListAgents, useCreateTask, useListOllamaModels, useUpdateTask, useDeleteTask, useUpdateProject, useDeleteProject } from "@workspace/api-client-react";
import { Link, useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { FolderKanban, MessageSquare, Play, Plus, Clock, BrainCircuit } from "lucide-react";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: project, isLoading: projectLoading, refetch: refetchProject } = useGetProject(id);
  const { data: tasksRes, isLoading: tasksLoading, refetch: refetchTasks } = useListProjectTasks(id);
  const { data: contextRes, isLoading: contextLoading } = useGetProjectContext(id);
  const { data: agentsRes } = useListAgents();
  const { data: modelsRes } = useListOllamaModels();

  const [showNewTask, setShowNewTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedModel, setSelectedModel] = useState("glm-5:cloud");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");

  const [editingProject, setEditingProject] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);

  const { mutate: deleteProject } = useDeleteProject({
    mutation: {
      onSuccess: () => navigate("/projects")
    }
  });

  const { mutate: updateProject, isPending: updatingProject } = useUpdateProject({
    mutation: {
      onSuccess: () => {
        setEditingProject(false);
        refetchProject();
      }
    }
  });

  const { mutate: deleteMutation } = useDeleteTask({
    mutation: {
      onSuccess: () => refetchTasks()
    }
  });

  const { mutate: updateMutation } = useUpdateTask({
    mutation: {
      onSuccess: () => {
        setEditingTaskId(null);
        refetchTasks();
      }
    }
  });

  const { mutate: createTask, isPending: creatingTask } = useCreateTask({
    mutation: {
      onSuccess: (task) => {
        navigate(`/projects/${id}/tasks/${task.id}`);
      }
    }
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !selectedAgentId) return;

    createTask({
      data: {
        projectId: id,
        title: taskTitle,
        agentId: selectedAgentId,
        model: selectedModel,
      }
    });
  };

  const tasks = tasksRes?.tasks || [];
  const context = contextRes?.context || [];
  const agents = agentsRes?.agents || [];
  const models = modelsRes?.models || [];

  if (projectLoading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><div className="w-8 h-8 rounded-full border-t-2 border-primary animate-spin"></div></div></AppLayout>;
  }

  if (!project) return <AppLayout><div className="text-center py-20 text-white">Project not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="glass-panel p-8 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 blur-[80px] pointer-events-none"></div>

          {editingProject ? (
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <span className="px-2 py-1 bg-secondary text-muted-foreground rounded text-[10px] uppercase font-mono tracking-wider mr-3 border border-white/5">
                  Project ID: {project.id.slice(0, 8)}
                </span>
              </div>
              <div className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Project Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white font-display text-2xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Description</label>
                  <textarea
                    value={editProjectDesc}
                    onChange={(e) => setEditProjectDesc(e.target.value)}
                    className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white text-base resize-none"
                    rows={2}
                  />
                </div>
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => updateProject({ id: project.id, data: { name: editProjectName, description: editProjectDesc } })}
                    disabled={updatingProject || !editProjectName.trim()}
                    className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    {updatingProject ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => setEditingProject(false)}
                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-white transition-colors bg-white/5 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2 relative z-10 w-full">
                <div className="flex items-center">
                  <span className="px-2 py-1 bg-secondary text-muted-foreground rounded text-[10px] uppercase font-mono tracking-wider mr-3 border border-white/5">
                    Project ID: {project.id.slice(0, 8)}
                  </span>
                  <span className="px-2 py-1 bg-accent/10 text-accent rounded text-[10px] uppercase font-mono tracking-wider border border-accent/20">
                    {project.status}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setEditProjectName(project.name);
                      setEditProjectDesc(project.description || "");
                      setEditingProject(true);
                    }}
                    className="p-2 text-muted-foreground hover:text-white rounded hover:bg-white/10 transition-colors"
                    title="Edit Project"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this project? This will also delete all its tasks, messages, and memory.")) {
                        deleteProject({ id: project.id });
                      }
                    }}
                    className="p-2 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 transition-colors"
                    title="Delete Project"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <h1 className="text-4xl font-display font-bold text-white tracking-tight mb-2 relative z-10">{project.name}</h1>
              <p className="text-muted-foreground max-w-2xl relative z-10">{project.description}</p>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Column - Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-display font-bold text-white flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-primary" /> Executions
              </h2>
              <button
                onClick={() => setShowNewTask(!showNewTask)}
                className="flex items-center px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4 mr-1" /> New Task
              </button>
            </div>

            {showNewTask && (
              <div className="glass-panel p-5 rounded-xl border-primary/30">
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Task Title</label>
                    <input
                      autoFocus
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white text-sm"
                      placeholder="e.g. Analyze market competitors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Assign Agent</label>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white text-sm appearance-none cursor-pointer"
                      required
                    >
                      <option value="" disabled>Select an agent...</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.emoji} {a.name} ({a.category})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Model</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white text-sm appearance-none cursor-pointer"
                    >
                      {models.length === 0 ? <option value="glm-5:cloud">glm-5:cloud</option> : models.map((m: any) => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={creatingTask || !taskTitle || !selectedAgentId}
                      className="flex items-center px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {creatingTask ? "Initializing..." : "Start Execution"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {tasksLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2].map(i => <div key={i} className="h-20 bg-secondary/30 rounded-xl border border-white/5"></div>)}
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12 glass-panel rounded-xl border-dashed">
                  <p className="text-muted-foreground text-sm">No tasks executed yet.</p>
                </div>
              ) : (
                tasks.map(task => {
                  const agent = agents.find(a => a.id === task.agentId);
                  return (
                    <div key={task.id} className="glass-panel p-4 rounded-xl hover:border-primary/40 group transition-all duration-200 flex flex-col relative w-full">
                      {editingTaskId === task.id ? (
                        <div className="flex items-center space-x-3 w-full">
                          <input
                            autoFocus
                            type="text"
                            value={editTaskTitle}
                            onChange={(e) => setEditTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateMutation({ id: task.id, data: { title: editTaskTitle } });
                              else if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-primary text-white text-sm"
                          />
                          <button onClick={() => updateMutation({ id: task.id, data: { title: editTaskTitle } })} className="px-3 py-1.5 bg-primary text-black text-sm font-medium rounded hover:bg-primary/90">Save</button>
                          <button onClick={() => setEditingTaskId(null)} className="px-3 py-1.5 bg-secondary text-white text-sm font-medium rounded hover:bg-secondary/80">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <Link href={`/projects/${id}/tasks/${task.id}`} className="flex-1 min-w-0 pr-4 block">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center text-xl mr-4 group-hover:border-primary/50 transition-colors shrink-0">
                                {agent?.emoji || "🤖"}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-white font-medium group-hover:text-primary transition-colors truncate">{task.title}</h4>
                                <div className="flex items-center mt-1 space-x-3 text-xs text-muted-foreground font-mono truncate">
                                  <span>{agent?.name || "Unknown Agent"}</span>
                                  <span>•</span>
                                  <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {format(new Date(task.updatedAt), "HH:mm")}</span>
                                  <span>•</span>
                                  <span>{task.model || "glm-5:cloud"}</span>
                                </div>
                              </div>
                            </div>
                          </Link>

                          <div className="flex items-center space-x-2 shrink-0">
                            <div className="px-2 py-1 rounded bg-secondary text-xs uppercase font-mono tracking-wider whitespace-nowrap hidden sm:block mr-2">
                              {task.status}
                            </div>

                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                              {task.status !== "running" && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditTaskTitle(task.title);
                                    setEditingTaskId(task.id);
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded transition-colors"
                                  title="Edit Task"
                                >
                                  ✏️
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this task?")) {
                                    deleteMutation({ id: task.id });
                                  }
                                }}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                title="Delete Task"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column - Context */}
          <div className="space-y-6">
            <h2 className="text-xl font-display font-bold text-white flex items-center">
              <BrainCircuit className="w-5 h-5 mr-2 text-accent" /> Project Memory
            </h2>

            <div className="glass-panel rounded-xl p-5 max-h-[600px] overflow-y-auto">
              {contextLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-secondary/30 rounded"></div>)}
                </div>
              ) : context.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Memory bank is empty. Executing tasks will populate project context.
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {context.map((ctx) => (
                    <div key={ctx.id} className="relative flex items-center justify-between group">
                      <div className="glass-panel w-full p-4 rounded-xl border-white/5 text-sm hover:border-primary/30 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-xs font-mono text-accent truncate max-w-[80%]">{ctx.key}</div>
                          <button
                            onClick={() => navigator.clipboard.writeText(ctx.value)}
                            className="text-[10px] text-muted-foreground hover:text-white bg-white/5 px-2 py-0.5 rounded"
                          >
                            Copy
                          </button>
                        </div>
                        <div className={`text-muted-foreground font-mono text-xs overflow-hidden transition-all duration-300 ${expandedMemoryId === ctx.id ? 'max-h-[500px] overflow-y-auto' : 'line-clamp-4 max-h-[80px]'}`}>
                          {ctx.value}
                        </div>
                        {ctx.value.length > 150 && (
                          <button
                            onClick={() => setExpandedMemoryId(expandedMemoryId === ctx.id ? null : ctx.id)}
                            className="mt-2 text-[10px] text-primary hover:underline"
                          >
                            {expandedMemoryId === ctx.id ? "Show Less" : "Read More..."}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
