import { Fragment, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Check,
  Copy,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Zap,
  ChevronRight,
  Activity,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react"

const TTS_SUPPORTED =
  typeof window !== "undefined" && "speechSynthesis" in window
import type { Citation, Stage, Coverage } from "../hooks/useStream"
import Pipeline from "./Pipeline"

const JAEGER_URL = import.meta.env.VITE_JAEGER_URL || ""

interface MessageProps {
  role: "user" | "assistant"
  text: string
  citations?: Citation[]
  stages?: Stage[]
  isStreaming?: boolean
  cached?: boolean
  stopped?: boolean
  error?: boolean
  queries?: string[]
  coverage?: Coverage | null
  followups?: string[]
  traceId?: string
  seq?: number
  time?: string
  isLast?: boolean
  pairedQuestion?: string
  onRegenerate?: () => void
  onFollowup?: (q: string) => void
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// lightweight, safe inline markdown + citation renderer (no innerHTML)
const TOKEN =
  /(\[\d+\])|\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*|_([^_]+)_/g

function renderRich(text: string, onCite: (id: number) => void): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  const pushPlain = (s: string) => {
    s.split("\n").forEach((line, i) => {
      if (i > 0) out.push(<br key={`br${key++}`} />)
      if (line) out.push(<Fragment key={`t${key++}`}>{line}</Fragment>)
    })
  }
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) pushPlain(text.slice(last, m.index))
    const [full, cite, bold, code, linkTxt, linkUrl, it1, it2] = m
    if (cite) {
      const id = parseInt(cite.slice(1, -1), 10)
      out.push(
        <sup
          key={`c${key++}`}
          className="footnote"
          role="button"
          tabIndex={0}
          aria-label={`Jump to source ${id}`}
          onClick={() => onCite(id)}
          onKeyDown={(e) => e.key === "Enter" && onCite(id)}
        >
          [{id}]
        </sup>,
      )
    } else if (bold) {
      out.push(<strong key={`b${key++}`}>{bold}</strong>)
    } else if (code) {
      out.push(
        <code
          key={`k${key++}`}
          className="mono"
          style={{
            background: "var(--paper-3)",
            padding: "0.05em 0.35em",
            fontSize: "0.85em",
            border: "1px solid var(--rule)",
          }}
        >
          {code}
        </code>,
      )
    } else if (linkTxt) {
      out.push(
        <a
          key={`l${key++}`}
          href={linkUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: "var(--blue)", textDecoration: "underline" }}
        >
          {linkTxt}
        </a>,
      )
    } else if (it1 || it2) {
      out.push(<em key={`i${key++}`}>{it1 || it2}</em>)
    }
    last = m.index! + full.length
  }
  if (last < text.length) pushPlain(text.slice(last))
  return out
}

export default function Message({
  role,
  text,
  citations = [],
  stages,
  isStreaming = false,
  cached = false,
  stopped = false,
  error = false,
  queries,
  coverage,
  followups,
  traceId,
  seq,
  time,
  isLast = false,
  pairedQuestion,
  onRegenerate,
  onFollowup,
}: MessageProps) {
  const [showWork, setShowWork] = useState(false)
  const [shareState, setShareState] = useState<"idle" | "ok" | "err">("idle")
  const [speaking, setSpeaking] = useState(false)

  const listen = () => {
    if (!TTS_SUPPORTED) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const u = new SpeechSynthesisUtterance(text.replace(/\[\d+\]/g, ""))
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }

  const share = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE_URL || ""
      const r = await fetch(`${base}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: pairedQuestion || "",
          answer: text,
          citations,
        }),
      })
      if (!r.ok) throw new Error("share failed")
      const { id } = await r.json()
      const url = `${window.location.origin}/share/${id}`
      await navigator.clipboard.writeText(url)
      setShareState("ok")
    } catch (e) {
      console.error("share failed", e)
      setShareState("err")
    } finally {
      setTimeout(() => setShareState("idle"), 2400)
    }
  }
  const [copied, setCopied] = useState(false)
  const isUser = role === "user"

  const copy = async () => {
    try {
      const sources = citations.length
        ? "\n\nSources:\n" +
          citations.map((c) => `[${c.id}] ${c.title} — ${c.url}`).join("\n")
        : ""
      await navigator.clipboard.writeText(text + sources)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.error("copy failed", err)
    }
  }

  const jumpToSource = (id: number) => {
    const el = document.getElementById(`source-${seq}-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.animate(
      [{ background: "var(--flame)" }, { background: "transparent" }],
      { duration: 1100, easing: "ease-out" },
    )
  }

  const body = useMemo(
    () => (isUser ? null : renderRich(text, jumpToSource)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, isUser, seq],
  )

  /* -------------------------------------------------- USER QUERY */
  if (isUser) {
    return (
      <div className="riso-in mx-auto w-full max-w-[760px]">
        <div className="mb-2 flex items-baseline gap-3">
          <span className="kicker" style={{ color: "var(--blue)" }}>
            Query {seq != null ? String(seq).padStart(2, "0") : ""}
          </span>
          <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
          {time && (
            <span className="mono text-[0.7rem]" style={{ color: "var(--ink-mute)" }}>
              {time}
            </span>
          )}
        </div>
        <p
          className="text-2xl leading-tight sm:text-3xl"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {text}
        </p>
      </div>
    )
  }

  /* -------------------------------------------------- ASSISTANT ANSWER */
  return (
    <div className="riso-in group mx-auto w-full max-w-[760px]">
      <div className="mb-2 flex items-center gap-3">
        <span className="kicker" style={{ color: "var(--flame)" }}>
          The Proof
        </span>
        {cached && (
          <span
            className="mono inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-widest"
            style={{ color: "var(--ink-mute)" }}
            title="Served from cache"
          >
            <Zap className="h-3 w-3" /> cached
          </span>
        )}
        <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
      </div>

      {!text && isStreaming ? (
        <Pipeline stages={stages ?? []} />
      ) : (
        <article
          className="paper-card px-6 py-7 sm:px-9 sm:py-9"
          style={{
            boxShadow: error ? "7px 7px 0 var(--flame)" : "7px 7px 0 var(--blue)",
          }}
        >
          {error ? (
            <p
              className="flex items-center gap-3 text-lg"
              style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}
            >
              <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--flame)" }} />
              {text}
            </p>
          ) : (
            <div
              className={`lead text-[1.18rem] leading-[1.72] ${isStreaming ? "caret" : ""}`}
              style={{ fontFamily: "var(--font-body)" }}
            >
              {body}
            </div>
          )}

          {stopped && (
            <p className="kicker mt-3" style={{ color: "var(--ink-mute)" }}>
              — stopped early
            </p>
          )}

          {/* Coverage — which required facts the evidence covered */}
          {coverage && coverage.slots.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="kicker" style={{ color: "var(--ink-mute)" }}>
                Coverage
              </span>
              <span className="flex gap-1">
                {coverage.slots.map((s, i) => (
                  <span
                    key={i}
                    title={s}
                    className="h-2.5 w-2.5"
                    style={{
                      background:
                        i < coverage.filled.length ? "var(--blue)" : "var(--paper-3)",
                      border: "1px solid var(--ink)",
                    }}
                  />
                ))}
              </span>
              <span className="mono text-[0.7rem]" style={{ color: "var(--ink-mute)" }}>
                {coverage.filled.length}/{coverage.slots.length} facts sourced
              </span>
            </div>
          )}

          {/* Show the work — the actual searches + trace */}
          {((queries && queries.length > 0) || (traceId && JAEGER_URL)) && (
            <div className="no-print mt-4">
              <button
                onClick={() => setShowWork((v) => !v)}
                aria-expanded={showWork}
                className="ring-riso mono inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-widest"
                style={{ color: "var(--ink-mute)" }}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${showWork ? "rotate-90" : ""}`}
                />
                Show the work
              </button>
              {showWork && (
                <div className="mt-2 border-l-2 pl-3" style={{ borderColor: "var(--rule)" }}>
                  {queries && queries.length > 0 && (
                    <>
                      <p className="kicker" style={{ color: "var(--ink-mute)" }}>
                        Searches run
                      </p>
                      <ul className="mb-2 mt-1 flex flex-col gap-1">
                        {queries.map((q, i) => (
                          <li
                            key={i}
                            className="mono text-[0.78rem]"
                            style={{ color: "var(--ink-soft)" }}
                          >
                            → {q}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {traceId && JAEGER_URL && (
                    <a
                      href={`${JAEGER_URL}/trace/${traceId}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mono inline-flex items-center gap-1 text-[0.72rem]"
                      style={{ color: "var(--blue)" }}
                    >
                      <Activity className="h-3.5 w-3.5" /> view trace ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* References */}
          {citations.length > 0 && (
            <div className="mt-8">
              <div className="rule-double mb-4" style={{ borderColor: "var(--ink)" }} />
              <h4 className="kicker mb-3" style={{ color: "var(--ink)" }}>
                Sources · {citations.length}
              </h4>
              <ul className="flex flex-col">
                {citations.map((c) => (
                  <li key={c.id} id={`source-${seq}-${c.id}`}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="ring-riso group/src flex items-center gap-3 border-t-2 py-3 transition-colors"
                      style={{ borderColor: "var(--rule)" }}
                    >
                      <span
                        className="mono shrink-0 text-sm font-bold"
                        style={{ color: "var(--flame)" }}
                      >
                        {String(c.id).padStart(2, "0")}
                      </span>
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${hostOf(c.url)}&sz=64`}
                        alt=""
                        width={18}
                        height={18}
                        className="shrink-0"
                        style={{ borderRadius: 2 }}
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate font-medium group-hover/src:underline"
                          style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}
                        >
                          {c.title || hostOf(c.url)}
                        </span>
                        <span
                          className="mono block truncate text-[0.72rem]"
                          style={{ color: "var(--ink-mute)" }}
                        >
                          {hostOf(c.url)}
                        </span>
                        {c.snippet && (
                          <span
                            className="mt-1 block max-h-0 overflow-hidden text-[0.82rem] leading-snug opacity-0 transition-all duration-200 group-hover/src:max-h-16 group-hover/src:opacity-100"
                            style={{ fontFamily: "var(--font-body)", color: "var(--ink-soft)" }}
                          >
                            {c.snippet}
                          </span>
                        )}
                      </span>
                      <ArrowUpRight
                        className="h-4 w-4 shrink-0 self-center opacity-40 transition-opacity group-hover/src:opacity-100"
                        style={{ color: "var(--blue)" }}
                        strokeWidth={2.5}
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {text && !isStreaming && (
            <div className="no-print mt-6 flex flex-wrap justify-end gap-2">
              {isLast && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="ring-riso mono inline-flex items-center gap-2 border-2 px-3 py-1.5 text-[0.72rem] uppercase tracking-widest transition-colors hover:bg-[var(--paper-3)]"
                  style={{ borderColor: "var(--ink)", color: "var(--ink)" }}
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} /> Regenerate
                </button>
              )}
              {TTS_SUPPORTED && (
                <button
                  onClick={listen}
                  aria-label={speaking ? "Stop reading" : "Read aloud"}
                  className="ring-riso mono inline-flex items-center gap-2 border-2 px-3 py-1.5 text-[0.72rem] uppercase tracking-widest transition-colors"
                  style={{
                    borderColor: "var(--ink)",
                    background: speaking ? "var(--flame)" : "transparent",
                    color: speaking ? "var(--paper)" : "var(--ink)",
                  }}
                >
                  {speaking ? (
                    <>
                      <VolumeX className="h-3.5 w-3.5" strokeWidth={2.5} /> Stop
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Listen
                    </>
                  )}
                </button>
              )}
              <button
                onClick={share}
                className="ring-riso mono inline-flex items-center gap-2 border-2 px-3 py-1.5 text-[0.72rem] uppercase tracking-widest transition-colors"
                style={{
                  borderColor: "var(--ink)",
                  background:
                    shareState === "ok"
                      ? "var(--blue)"
                      : shareState === "err"
                        ? "var(--flame)"
                        : "transparent",
                  color:
                    shareState === "ok" || shareState === "err"
                      ? "var(--paper)"
                      : "var(--ink)",
                }}
              >
                {shareState === "ok" ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Link copied
                  </>
                ) : shareState === "err" ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} /> Failed
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Share
                  </>
                )}
              </button>
              <button
                onClick={copy}
                className="ring-riso mono inline-flex items-center gap-2 border-2 px-3 py-1.5 text-[0.72rem] uppercase tracking-widest transition-colors"
                style={{
                  borderColor: "var(--ink)",
                  background: copied ? "var(--blue)" : "transparent",
                  color: copied ? "var(--paper)" : "var(--ink)",
                }}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" strokeWidth={2.5} /> Copy + sources
                  </>
                )}
              </button>
            </div>
          )}
        </article>
      )}

      {/* Follow-up suggestions */}
      {followups && followups.length > 0 && !isStreaming && (
        <div className="no-print mt-4 flex flex-wrap items-stretch gap-2">
          <span className="kicker self-center" style={{ color: "var(--ink-mute)" }}>
            Next
          </span>
          {followups.map((f, i) => (
            <button
              key={i}
              onClick={() => onFollowup?.(f)}
              className="q-card ring-riso px-3 py-2 text-left text-sm"
              style={{
                boxShadow: "3px 3px 0 var(--blue)",
                fontFamily: "var(--font-body)",
                color: "var(--ink)",
              }}
            >
              {f} <span style={{ color: "var(--flame)" }}>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
