import { useEffect, useRef } from "react"
import type { Message as MessageType } from "../hooks/useStream"
import Message from "./Message"
import ChatInput from "./ChatInput"

interface ChatProps {
  messages: MessageType[]
  ask: (question: string) => void
  isLoading: boolean
  onStop: () => void
  onRegenerate: () => void
}

const SAMPLES: { q: string; tag: string }[] = [
  { q: "What were the biggest announcements at the latest Apple event?", tag: "Tech" },
  { q: "Who is leading the 2026 Formula 1 championship?", tag: "Sport" },
  { q: "Explain the most recent breakthrough in fusion energy.", tag: "Science" },
  { q: "What's moving global markets this week?", tag: "Markets" },
  { q: "Summarize the newest frontier AI model and what it can do.", tag: "AI" },
  { q: "What's the latest on NASA's Artemis Moon programme?", tag: "Space" },
]

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export default function Chat({
  messages,
  ask,
  isLoading,
  onStop,
  onRegenerate,
}: ChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const lastId = messages[messages.length - 1]?.id
  let queryNo = 0

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* ---------------------------------------- POSTER / EMPTY STATE */
          <div className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14">
            <p className="kicker mb-5" style={{ color: "var(--blue)" }}>
              ◆ Generate · Search · Reflect · Synthesize
            </p>
            <h2
              className="riso-title text-[3.4rem] leading-[0.9] sm:text-[5.2rem] lg:text-[6rem]"
              data-text="SOURCED."
            >
              SOURCED.
            </h2>
            <p
              className="mt-6 max-w-2xl text-xl leading-relaxed"
              style={{ fontFamily: "var(--font-body)", color: "var(--ink-soft)" }}
            >
              Ask anything. PROOF researches the open web, reflects on what it finds,
              and answers in <em>under eighty words</em> — every claim set in print and{" "}
              <span style={{ color: "var(--flame)", fontWeight: 600 }}>
                backed by a citation
              </span>
              .
            </p>

            {/* fresh question cards */}
            <div className="mt-10 flex items-center gap-3">
              <span className="kicker" style={{ color: "var(--ink)" }}>
                Start the run
              </span>
              <span className="h-[2px] flex-1" style={{ background: "var(--rule)" }} />
            </div>
            <div
              className="mt-5"
              style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              }}
            >
              {SAMPLES.map((s, i) => (
                <button
                  key={s.q}
                  onClick={() => ask(s.q)}
                  className="q-card ring-riso group flex flex-col p-5 text-left"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="kicker" style={{ color: "var(--flame)" }}>
                      {s.tag}
                    </span>
                    <span
                      className="mono text-lg transition-transform group-hover:translate-x-1"
                      style={{ color: "var(--blue)" }}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </div>
                  <span
                    className="text-lg leading-snug"
                    style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}
                  >
                    {s.q}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ---------------------------------------- CONVERSATION */
          <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
            {messages.map((m, idx) => {
              if (m.role === "user") queryNo += 1
              const pairedQuestion =
                m.role === "assistant" && idx > 0 && messages[idx - 1].role === "user"
                  ? messages[idx - 1].text
                  : undefined
              return (
                <Message
                  key={m.id}
                  pairedQuestion={pairedQuestion}
                  role={m.role}
                  text={m.text}
                  citations={m.citations}
                  stages={m.stages}
                  isStreaming={m.isStreaming}
                  waking={m.waking}
                  cached={m.cached}
                  stopped={m.stopped}
                  error={m.error}
                  queries={m.queries}
                  coverage={m.coverage}
                  followups={m.followups}
                  traceId={m.traceId}
                  seq={queryNo}
                  time={m.role === "user" ? fmtTime(m.timestamp) : undefined}
                  isLast={m.id === lastId && !isLoading}
                  onRegenerate={onRegenerate}
                  onFollowup={ask}
                />
              )
            })}
            <div ref={bottomRef} className="h-2" />
          </div>
        )}
      </div>

      <div
        className="no-print shrink-0"
        style={{ borderTop: "3px solid var(--ink)", background: "var(--paper)" }}
      >
        <ChatInput onSend={ask} isLoading={isLoading} onStop={onStop} />
      </div>
    </div>
  )
}
