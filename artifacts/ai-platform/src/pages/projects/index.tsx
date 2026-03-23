import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useListProjects, useCreateProject, useDeleteProject, useUpdateProject } from "@workspace/api-client-react";
import { Link } from "wouter";
import { FolderKanban, Plus, Terminal } from "lucide-react";
import { format } from "date-fns";

export default function ProjectsPage() {
  const { data, isLoading, refetch } = useListProjects();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { mutate: deleteProject } = useDeleteProject({
    mutation: {
      onSuccess: () => refetch()
    }
  });

  const { mutate: updateProject } = useUpdateProject({
    mutation: {
      onSuccess: () => {
        setEditingProjectId(null);
        refetch();
      }
    }
  });

  const { mutate: create, isPending } = useCreateProject({
    mutation: {
      onSuccess: () => {
        setShowNew(false);
        setName("");
        setDescription("");
        refetch();
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create({ data: { name, description } });
  };

  const projects = data?.projects || [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-display font-bold text-white tracking-tight">Active <span className="text-accent text-glow">Projects</span></h1>
            <p className="text-muted-foreground mt-2 font-mono text-sm">Containers for multi-agent workflows.</p>
          </div>
          
          <button 
            onClick={() => setShowNew(true)}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Initialize Project
          </button>
        </div>

        {showNew && (
          <div className="glass-panel p-6 rounded-2xl border-primary/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary glow-primary"></div>
            <h3 className="text-lg font-display font-bold text-white mb-4">Initialize New Container</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Codename</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white font-mono"
                  placeholder="e.g. Project Nexus"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Objective</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:border-primary text-white text-sm"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowNew(false)}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isPending || !name.trim()}
                  className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Initialize"}
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="glass-panel h-32 rounded-2xl animate-pulse"></div>)}
          </div>
        ) : projects.length === 0 && !showNew ? (
          <div className="text-center py-20 glass-panel rounded-2xl border-dashed">
            <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white">No projects found</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-6">Create a project to start orchestrating agents.</p>
            <button 
              onClick={() => setShowNew(true)}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors border border-white/10 text-white"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              editingProjectId === project.id ? (
                <div key={project.id} className="glass-panel p-6 rounded-2xl h-full flex flex-col relative border-primary/50">
                  <h3 className="text-sm font-bold text-white mb-2 uppercase font-mono tracking-wider">Edit Project</h3>
                  <div className="space-y-3 mb-4">
                    <input 
                      autoFocus
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-primary text-white font-mono text-sm"
                      placeholder="Project Name"
                    />
                    <textarea 
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-primary text-white text-sm resize-none"
                      placeholder="Project Description"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end space-x-2 mt-auto">
                    <button 
                      onClick={() => setEditingProjectId(null)}
                      className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-white transition-colors hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => updateProject({ id: project.id, data: { name: editName, description: editDescription } })}
                      className="px-3 py-1.5 bg-primary text-black rounded text-xs font-bold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="glass-panel p-6 rounded-2xl hover:border-accent/40 group transition-all duration-300 hover:-translate-y-1 h-full flex flex-col cursor-pointer relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start mb-3 relative z-10 w-full">
                      <div className="flex items-center min-w-0 pr-2">
                        <Terminal className="w-5 h-5 text-accent mr-2 shrink-0" />
                        <h3 className="text-lg font-bold text-white group-hover:text-glow font-display truncate">{project.name}</h3>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center bg-black/40 rounded-lg p-1 transition-opacity border border-white/5 shrink-0">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditName(project.name);
                            setEditDescription(project.description || "");
                            setEditingProjectId(project.id);
                          }}
                          className="p-1.5 text-muted-foreground hover:text-white rounded hover:bg-white/10 transition-colors"
                          title="Edit Project"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm("Are you sure you want to delete this project? This will also delete all its tasks, messages, and memory.")) {
                              deleteProject({ id: project.id });
                            }
                          }}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 transition-colors"
                          title="Delete Project"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-6 flex-1 pr-2 line-clamp-3">
                      {project.description || <span className="italic opacity-50">No description provided</span>}
                    </p>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-white/5 mt-auto relative z-10">
                      <span className="text-xs font-mono text-muted-foreground">
                        {format(new Date(project.createdAt), "MMM d, yyyy")}
                      </span>
                      <span className="px-2 py-1 bg-accent/10 text-accent rounded text-[10px] uppercase font-mono tracking-wider border border-accent/20">
                        {project.status}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
