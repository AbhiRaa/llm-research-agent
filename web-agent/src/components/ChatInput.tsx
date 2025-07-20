import { useState, useRef, useEffect } from "react"
import type { KeyboardEvent } from "react"
import { Send, Search } from "lucide-react"

export default function ChatInput({ onSend }: { onSend: (q: string) => void }) {
  const [val, setVal] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const send = () => {
    const q = val.trim()
    if (q) {
      onSend(q)
      setVal("")
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [val])

  return (
    <div className="py-6 sm:py-8">
      <div className="relative">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/50 bg-white backdrop-blur-sm p-4 shadow-xl ring-1 ring-black/5 transition-all duration-300 focus-within:border-violet-400/50 focus-within:bg-white focus-within:shadow-2xl focus-within:ring-4 focus-within:ring-violet-100/30 dark:border-slate-700/30 dark:bg-slate-800/90 dark:ring-white/10 dark:focus-within:border-violet-500/50 dark:focus-within:bg-slate-800/95 dark:focus-within:ring-violet-900/20 sm:p-6">
          <div className="flex-shrink-0">
            <Search className="h-7 w-7 text-slate-500 dark:text-slate-400" />
          </div>

          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder="Ask me anything..."
              className="w-full resize-none bg-transparent text-xl font-medium outline-none"
              style={{ 
                minHeight: "40px", 
                maxHeight: "200px",
                color: "var(--text-color, #1f2937)",
                caretColor: "var(--text-color, #1f2937)"
              }}
            />
          </div>

          <button
            onClick={send}
            disabled={!val.trim()}
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg ring-1 ring-violet-500/20 transition-all duration-200 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 hover:shadow-xl hover:scale-105 hover:ring-violet-500/30 disabled:cursor-not-allowed disabled:from-slate-300 disabled:via-slate-400 disabled:to-slate-500 disabled:shadow-sm disabled:scale-100 disabled:ring-0 dark:disabled:from-slate-600 dark:disabled:via-slate-700 dark:disabled:to-slate-800"
          >
            <Send className="h-6 w-6" />
          </button>
        </div>

        {/* Pro tip */}
        <div className="mt-4 text-center sm:mt-6">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Press <kbd className="mx-1 rounded-lg bg-slate-100/80 px-2.5 py-1.5 text-xs font-mono font-semibold shadow-sm ring-1 ring-slate-200/50 dark:bg-slate-800/80 dark:ring-slate-700/50">Enter</kbd> to search &nbsp; 
            <kbd className="mx-1 rounded-lg bg-slate-100/80 px-2.5 py-1.5 text-xs font-mono font-semibold shadow-sm ring-1 ring-slate-200/50 dark:bg-slate-800/80 dark:ring-slate-700/50">Shift + Enter</kbd> for new line
          </p>
        </div>
      </div>
    </div>
  )
}
