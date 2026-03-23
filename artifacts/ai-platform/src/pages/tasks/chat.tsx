import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetTask, useGetTaskMessages, useListAgents, useGetProject } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { Send, ArrowLeft, Terminal, AlertTriangle } from "lucide-react";
import { useTaskStream } from "@/hooks/use-task-stream";
import { ChatMessage } from "@/components/chat/chat-message";
import { ThinkingBlock } from "@/components/chat/thinking-block";

export default function TaskChat() {
  const { projectId, taskId } = useParams<{ projectId: string, taskId: string }>();
  
  const { data: project } = useGetProject(projectId);
  const { data: task, refetch: refetchTask } = useGetTask(taskId);
  const { data: messagesRes, isLoading: isLoadingMessages, refetch: refetchMessages } = useGetTaskMessages(taskId);
  const { data: agentsRes } = useListAgents();
  
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { isStreaming, thinking, content: streamContent, error, startStream, done } = useTaskStream();

  const messages = messagesRes?.messages || [];
  const agent = agentsRes?.agents?.find(a => a.id === task?.agentId);

  // Pre-fill input if we just created this task from the AI Planner and it has a drafted prompt
  useEffect(() => {
    if (task && !isLoadingMessages && messages.length === 0 && !input && task.description) {
      setInput(task.description);
    }
  }, [task, isLoadingMessages, messages.length, input]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent, thinking]);

  // Refetch when stream finishes
  useEffect(() => {
    if (done) {
      refetchMessages();
      refetchTask();
    }
  }, [done, refetchMessages, refetchTask]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    startStream(taskId, {
      message: input,
      enableThinking: true,
      // Uses defaults from backend
    });
    
    setInput("");
  };

  if (!task) return <AppLayout><div className="flex h-full items-center justify-center"><div className="animate-spin w-8 h-8 rounded-full border-t-2 border-primary"></div></div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        
        {/* Header */}
        <div className="flex-none pb-4 border-b border-white/10 mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <Link href={`/projects/${projectId}`} className="p-2 mr-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center">
                <span className="text-xl mr-2">{agent?.emoji}</span>
                <h1 className="text-xl font-display font-bold text-white">{task.title}</h1>
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                Project: {project?.name} • Agent: <span className="text-primary">{agent?.name}</span>
              </p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center px-3 py-1.5 rounded bg-black/40 border border-white/5 text-xs font-mono">
            <Terminal className="w-3.5 h-3.5 mr-2 text-accent" />
            {task.model || "glm-5:cloud"}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto pr-4" ref={scrollRef}>
          {messages.length === 0 && !isStreaming && !streamContent && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-3xl mb-4 shadow-inner">
                {agent?.emoji || "🤖"}
              </div>
              <p className="text-lg font-display text-white">Initialize execution protocol</p>
              <p className="text-sm font-mono text-muted-foreground mt-2 max-w-md">
                Agent {agent?.name} is ready. Provide instructions to begin the task.
              </p>
            </div>
          )}

          {/* Historical Messages */}
          {messages.map(msg => (
            <ChatMessage 
              key={msg.id} 
              role={msg.role as any} 
              content={msg.content} 
              agentName={agent?.name}
              agentEmoji={agent?.emoji}
            />
          ))}

          {/* Active Stream */}
          {(isStreaming || streamContent || thinking) && (
            <div className="mb-6">
              <ThinkingBlock content={thinking} isStreaming={isStreaming && !streamContent} />
              
              {streamContent && (
                <ChatMessage 
                  role="assistant" 
                  content={streamContent + (isStreaming ? " █" : "")} 
                  agentName={agent?.name}
                  agentEmoji={agent?.emoji}
                />
              )}
            </div>
          )}

          {error && (
            <div className="p-4 mb-6 rounded-lg bg-destructive/10 border border-destructive text-destructive flex items-start">
              <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold font-display">Execution Error</h4>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-none pt-4">
          <form onSubmit={handleSend} className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send message or instructions..."
              className="w-full h-[100px] resize-none bg-black/50 border border-white/10 rounded-2xl p-4 pr-16 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-white placeholder:text-muted-foreground shadow-2xl glass-panel text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="absolute right-3 bottom-3 p-3 rounded-xl bg-primary text-black hover:bg-primary/90 disabled:opacity-50 transition-all glow-primary"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Shift+Enter for newline • Powered by local Ollama</span>
          </div>
        </div>
        
      </div>
    </AppLayout>
  );
}
