import clsx from "clsx"
import { User, Bot, Copy, Check, ExternalLink } from "lucide-react"
import { useState, useMemo } from "react"
import type { Citation } from "@/hooks/useStream"

export default function Message({
  role,
  text,
  citations: messageCitations = [],
}: {
  role: "user" | "assistant"
  text: string
  citations?: Citation[]
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

  // Process citations from the backend response
  const { content, citations } = useMemo(() => {
    if (!text || isUser) return { content: text, citations: [] }

    // Use citations from the backend if available
    if (messageCitations && messageCitations.length > 0) {
      let processedContent = text
      
      // Replace citation markers with clickable buttons
      messageCitations.forEach(citation => {
        processedContent = processedContent.replace(
          new RegExp(`\\[${citation.id}\\]`, 'g'),
          `__CITATION_${citation.id}__`
        )
      })

      return { content: processedContent, citations: messageCitations }
    }

    // Fallback: parse citations from text if no backend citations
    const citationRegex = /\[(\d+)\]/g
    const matches = Array.from(text.matchAll(citationRegex))
    
    const parsedCitations = matches.map((match) => ({
      id: parseInt(match[1]),
      title: `Source ${match[1]}`,
      url: `https://example.com/source-${match[1]}`,
    }))

    let processedContent = text
    parsedCitations.forEach(citation => {
      processedContent = processedContent.replace(
        new RegExp(`\\[${citation.id}\\]`, 'g'),
        `__CITATION_${citation.id}__`
      )
    })

    return { content: processedContent, citations: parsedCitations }
  }, [text, isUser, messageCitations])

  const renderContentWithCitations = (content: string) => {
    if (!citations.length) return content

    const parts = content.split(/(__CITATION_\d+__)/g)
    
    return parts.map((part, index) => {
      const citationMatch = part.match(/__CITATION_(\d+)__/)
      if (citationMatch) {
        const citationIdStr = citationMatch[1]
        const citationId = parseInt(citationIdStr)
        const citation = citations.find(c => c.id === citationId)
        if (citation) {
          return (
            <button
              key={index}
              onClick={() => window.open(citation.url, '_blank')}
              className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors dark:bg-blue-900/50 dark:hover:bg-blue-800/50 dark:text-blue-300"
            >
              {citationIdStr}
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )
        }
      }
      return part
    })
  }

  return (
    <div className={clsx("group mb-20 flex gap-6 max-w-none sm:mb-32 sm:gap-8", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-2">
        <div
          className={clsx(
            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl ring-1 sm:w-14 sm:h-14",
            isUser
              ? "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 ring-violet-500/20"
              : "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 dark:from-slate-400 dark:via-slate-500 dark:to-slate-600 ring-slate-500/20 dark:ring-slate-400/20",
          )}
        >
          {isUser ? <User className="w-6 h-6 text-white sm:w-7 sm:h-7" /> : <Bot className="w-6 h-6 text-white dark:text-slate-900 sm:w-7 sm:h-7" />}
        </div>
      </div>

      {/* Message Content */}
      <div className={clsx("flex-1 min-w-0", isUser ? "flex justify-end" : "flex justify-start")}>
        <div className={clsx("w-full", isUser ? "max-w-[85%]" : "max-w-none")}>
          <div className="relative">
            <div
              className={clsx(
                "rounded-2xl px-8 py-8 shadow-lg ring-1 sm:px-10 sm:py-9",
                isUser
                  ? "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white ring-violet-500/20"
                  : "bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-200/40 dark:border-slate-700/40 backdrop-blur-sm ring-black/5 dark:ring-white/10",
              )}
            >
              {text ? (
                <div className="text-lg leading-relaxed whitespace-pre-wrap font-medium sm:text-xl">
                  {renderContentWithCitations(content)}
                </div>
              ) : (
                <div className="flex items-center gap-4 text-lg opacity-70 sm:gap-5 sm:text-xl">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div
                      className="w-3 h-3 bg-current rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="w-3 h-3 bg-current rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                  <span className="italic font-medium">Searching and analyzing...</span>
                </div>
              )}
            </div>

            {/* Copy Button - Moved to right side */}
            {text && !isUser && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={copyToClipboard}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all opacity-0 group-hover:opacity-100",
                    "bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 shadow-lg hover:shadow-xl",
                    "text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-green-600 dark:text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy answer</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Citations */}
          {citations.length > 0 && (
            <div className="mt-10 space-y-6">
              <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                <div className="w-1.5 h-6 bg-gradient-to-b from-violet-500 to-purple-600 rounded-full"></div>
                Sources
              </h4>
              <div className="grid gap-5">
                {citations.map((citation) => (
                  <button
                    key={citation.id}
                    onClick={() => window.open(citation.url, '_blank')}
                    className="group flex items-center gap-6 p-6 rounded-2xl border border-slate-200/50 bg-white/70 backdrop-blur-sm shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:bg-white/90 hover:shadow-xl hover:scale-[1.01] hover:-translate-y-0.5 text-left dark:border-slate-700/50 dark:bg-slate-800/70 dark:ring-white/10 dark:hover:bg-slate-800/90"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg ring-1 ring-violet-500/20 flex items-center justify-center">
                      <span className="text-base font-bold text-white">{citation.id}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold text-slate-900 dark:text-white truncate group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">{citation.title}</p>
                      <p className="text-base text-slate-600 dark:text-slate-400 font-medium mt-1">
                        {(() => {
                          try {
                            return new URL(citation.url).hostname
                          } catch {
                            return citation.url
                          }
                        })()}
                      </p>
                    </div>
                    <ExternalLink className="w-6 h-6 text-slate-400 dark:text-slate-500 flex-shrink-0 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
