import { useRef, useEffect } from "react"
import { useStream } from "../hooks/useStream"
import Message from "./Message"
import Textarea from "./Textarea"
import { Search, Globe } from "lucide-react"

export default function Chat() {
  const { messages, ask } = useStream()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
              <Search className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Web Search Agent</h1>
              <p className="text-sm text-gray-600">Intelligent web search and analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-green-700">Ready</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            {/* Welcome Section */}
            <div className="mb-16 flex flex-col items-center text-center">
              <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-600 shadow-sm">
                <Globe className="h-12 w-12 text-white" />
              </div>
              <h2 className="mb-4 text-4xl font-bold text-gray-900">Welcome to the Web Search Agent</h2>
              <p className="max-w-2xl text-lg text-gray-600">
                Ask me anything and I'll search the web to provide you with comprehensive, up-to-date information.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="mb-16 grid w-full max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <Search className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Real-time Search</h3>
                </div>
                <p className="text-gray-600">
                  Get the latest information from across the web with intelligent search capabilities
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                    <Globe className="h-4 w-4 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Comprehensive Analysis</h3>
                </div>
                <p className="text-gray-600">Receive detailed analysis and insights from multiple sources</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl px-4 py-8">
              {messages.map((m) => (
                <Message key={m.id} role={m.role} text={m.text} />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-4xl">
            <Textarea onSend={ask} />
          </div>
        </div>
      </div>
    </div>
  )
}
