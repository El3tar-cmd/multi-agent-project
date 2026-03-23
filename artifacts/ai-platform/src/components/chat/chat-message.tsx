import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  agentName?: string;
  agentEmoji?: string;
}

export function ChatMessage({ role, content, agentName, agentEmoji }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full mb-6", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%]", isUser ? "flex-row-reverse" : "flex-row")}>
        
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg",
          isUser 
            ? "ml-4 bg-secondary border-white/10" 
            : "mr-4 bg-primary/10 border-primary/30 glow-primary"
        )}>
          {isUser ? (
            <User className="w-5 h-5 text-muted-foreground" />
          ) : (
            agentEmoji ? (
              <span className="text-xl">{agentEmoji}</span>
            ) : (
              <Bot className="w-5 h-5 text-primary" />
            )
          )}
        </div>

        {/* Message Body */}
        <div className="flex flex-col">
          {!isUser && agentName && (
            <span className="text-xs font-mono text-primary/80 mb-1 ml-1 tracking-wider uppercase">
              {agentName}
            </span>
          )}
          
          <div className={cn(
            "px-5 py-4 rounded-2xl",
            isUser 
              ? "bg-secondary text-foreground rounded-tr-sm border border-white/5" 
              : "bg-card border border-primary/20 rounded-tl-sm shadow-xl shadow-black/50"
          )}>
            <div className={cn(
              "prose prose-sm md:prose-base dark:prose-invert max-w-none leading-relaxed",
              "prose-p:text-foreground/90 prose-headings:text-white prose-headings:font-display",
              "prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 prose-pre:shadow-inner",
              "prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:rounded",
              "prose-strong:text-white"
            )}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
