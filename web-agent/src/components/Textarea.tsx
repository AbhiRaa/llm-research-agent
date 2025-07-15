import { useState, useRef, useEffect } from "react"
import type { KeyboardEvent } from "react"
import { Send, Paperclip } from "lucide-react"

export default function Textarea({ onSend }: { onSend: (q: string) => void }) {
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
    <div className="p-6">
      <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <button className="flex-shrink-0 p-2 text-gray-400 transition-colors hover:text-gray-600">
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Ask me anything about the web..."
            className="w-full resize-none bg-transparent text-base text-gray-900 placeholder-gray-500 outline-none"
            style={{ minHeight: "24px" }}
          />
        </div>

        <button
          onClick={send}
          disabled={!val.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-200 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          <Send className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </div>
  )
}
