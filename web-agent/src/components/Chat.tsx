import { useRef, useEffect } from "react"
import type { Message as MessageType } from "@/hooks/useStream"
import Message from "./Message"
import TextArea from "src/components/TextArea"
import { Sparkles, Globe, Zap, BookOpen } from "lucide-react"

interface ChatProps {
  messages: MessageType[]
  ask: (question: string) => void
}

export default function Chat({ messages, ask }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="h-full flex flex-col">
      {messages.length === 0 ? (
        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center py-12 sm:py-20">
            <div className="w-full">
            {/* Hero Section */}
            <div className="mb-12 text-center sm:mb-16">
              <h1 className="mb-4 text-5xl font-bold tracking-tight sm:mb-6 sm:text-7xl lg:text-8xl text-slate-900 dark:text-white">
                Where knowledge begins
              </h1>
              <p className="mx-auto text-xl leading-relaxed text-slate-600 dark:text-slate-300 sm:text-2xl">
                Ask me anything and get comprehensive, well-sourced answers powered by advanced AI search capabilities.
              </p>
            </div>

            {/* Example Questions */}
            <div className="mb-8 sm:mb-12">
              <h2 className="mb-6 text-center text-lg font-semibold text-slate-700 dark:text-slate-300 sm:mb-8 sm:text-xl">
                Try asking about
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
                <button 
                  onClick={() => ask("What are the latest developments in AI technology?")}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/30 bg-white/80 backdrop-blur-sm p-8 text-left shadow-xl ring-1 ring-black/5 transition-all duration-300 hover:bg-white/90 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 dark:border-slate-600/30 dark:bg-slate-700/80 dark:ring-white/10 dark:hover:bg-slate-700/90"
                >
                  <div className="relative z-10">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-lg ring-1 ring-blue-500/20">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">AI Technology</h3>
                    </div>
                    <p className="text-base font-medium text-slate-600 dark:text-slate-300">
                      Latest developments in artificial intelligence
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>

                <button 
                  onClick={() => ask("Explain quantum computing in simple terms")}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/30 bg-white/80 backdrop-blur-sm p-8 text-left shadow-xl ring-1 ring-black/5 transition-all duration-300 hover:bg-white/90 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 dark:border-slate-600/30 dark:bg-slate-700/80 dark:ring-white/10 dark:hover:bg-slate-700/90"
                >
                  <div className="relative z-10">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 shadow-lg ring-1 ring-purple-500/20">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Quantum Computing</h3>
                    </div>
                    <p className="text-base font-medium text-slate-600 dark:text-slate-300">
                      Complex concepts explained simply
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>

                <button 
                  onClick={() => ask("What's happening in global markets today?")}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/30 bg-white/80 backdrop-blur-sm p-8 text-left shadow-xl ring-1 ring-black/5 transition-all duration-300 hover:bg-white/90 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 dark:border-slate-600/30 dark:bg-slate-700/80 dark:ring-white/10 dark:hover:bg-slate-700/90"
                >
                  <div className="relative z-10">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 shadow-lg ring-1 ring-green-500/20">
                        <Globe className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Global Markets</h3>
                    </div>
                    <p className="text-base font-medium text-slate-600 dark:text-slate-300">
                      Current financial and economic trends
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>

                <button 
                  onClick={() => ask("How does renewable energy compare to fossil fuels?")}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/30 bg-white/80 backdrop-blur-sm p-8 text-left shadow-xl ring-1 ring-black/5 transition-all duration-300 hover:bg-white/90 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 dark:border-slate-600/30 dark:bg-slate-700/80 dark:ring-white/10 dark:hover:bg-slate-700/90"
                >
                  <div className="relative z-10">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-lg ring-1 ring-emerald-500/20">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Renewable Energy</h3>
                    </div>
                    <p className="text-base font-medium text-slate-600 dark:text-slate-300">
                      Environmental and sustainability insights
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pt-8 sm:pt-12">
          <div className="w-full pb-8">
            {messages.map((m, index) => (
              <div key={m.id}>
                {/* Add large gap between conversation threads */}
                {index > 0 && m.role === 'user' && (
                  <div className="py-16 sm:py-24">
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent dark:via-slate-700/50"></div>
                  </div>
                )}
                <Message role={m.role} text={m.text} citations={m.citations} />
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-slate-200/20 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 dark:border-slate-700/20 dark:bg-slate-800/80 dark:supports-[backdrop-filter]:bg-slate-800/80">
        <div className="w-full">
          <TextArea onSend={ask} />
        </div>
      </div>
    </div>
  )
}
