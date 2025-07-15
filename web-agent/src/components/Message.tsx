import clsx from "clsx"
import { User, Bot, Copy, Check } from "lucide-react"
import { useState } from "react"

export default function Message({
  role,
  text,
}: {
  role: "user" | "assistant"
  text: string
}) {
  const [copied, setCopied] = useState(false)
  const isUser = role === "user"

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <div className={clsx("group mb-6 flex gap-4", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={clsx(
          "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm",
          isUser
            ? "bg-gradient-to-br from-blue-500 to-indigo-600"
            : "bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-300 dark:to-slate-400",
        )}
      >
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white dark:text-slate-900" />}
      </div>

      {/* Message Content */}
      <div className={clsx("flex-1 min-w-0", isUser ? "flex justify-end" : "flex justify-start")}>
        <div
          className={clsx(
            "relative max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
            isUser
              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
              : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60",
          )}
        >
          {text ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{text}</div>
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-60">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
              <span className="italic">Thinking...</span>
            </div>
          )}

          {/* Copy Button */}
          {text && !isUser && (
            <button
              onClick={copyToClipboard}
              className={clsx(
                "absolute -top-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100",
                "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 shadow-sm",
              )}
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="w-3 h-3 text-slate-600 dark:text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
