import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
}

export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);

  if (!content && !isStreaming) return null;

  return (
    <div className="mb-4 mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors group"
      >
        {isStreaming ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        ) : (
          <Brain className="w-3.5 h-3.5 group-hover:text-primary" />
        )}
        <span className="group-hover:text-glow">
          {isStreaming ? "Neural reasoning in progress..." : "View reasoning process"}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (content || isStreaming) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "mt-2 p-4 rounded-lg bg-black/40 border border-primary/20",
              "font-mono text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed",
              "relative before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-primary/50"
            )}>
              {content}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
