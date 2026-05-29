import { useCallback, useEffect, useRef, useState } from "react"

export interface Citation {
  id: number
  title: string
  url: string
  snippet?: string
}

export type StageName = "generate" | "search" | "reflect" | "synthesize"
export type StageStatus = "pending" | "running" | "done"

export interface Stage {
  name: StageName
  status: StageStatus
  docs?: number
}

export interface Coverage {
  slots: string[]
  filled: string[]
}

export interface Message {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: Date
  isStreaming?: boolean
  waking?: boolean
  stopped?: boolean
  cached?: boolean
  error?: boolean
  citations?: Citation[]
  stages?: Stage[]
  queries?: string[]
  coverage?: Coverage | null
  followups?: string[]
  traceId?: string
}

export type AnswerFormat = "prose" | "bullets" | "tldr"
export type Recency = "any" | "day" | "week" | "month"

export interface Controls {
  maxWords: number
  maxSources: number
  recency: Recency
  fmt: AnswerFormat
}

export const DEFAULT_CONTROLS: Controls = {
  maxWords: 80,
  maxSources: 3,
  recency: "any",
  fmt: "prose",
}

export interface SessionMeta {
  id: string
  title: string
  updatedAt: number
}

const SESS_KEY = "proof-sessions"
const ACTIVE_KEY = "proof-active-session"
const LEGACY_KEY = "proof-conversation"
const CONTROLS_KEY = "proof-controls"
const msgKey = (id: string) => `proof-msgs-${id}`

function loadControls(): Controls {
  try {
    const raw = localStorage.getItem(CONTROLS_KEY)
    return raw ? { ...DEFAULT_CONTROLS, ...JSON.parse(raw) } : DEFAULT_CONTROLS
  } catch {
    return DEFAULT_CONTROLS
  }
}

const genId = () => Math.random().toString(36).slice(2, 11)

function reviveMessages(raw: string): Message[] {
  try {
    return (JSON.parse(raw) as Message[]).map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
      isStreaming: false,
    }))
  } catch {
    return []
  }
}

function loadSessionMessages(id: string): Message[] {
  const raw = localStorage.getItem(msgKey(id))
  return raw ? reviveMessages(raw) : []
}

function titleFromMessages(msgs: Message[], fallback = "New session"): string {
  const firstUser = msgs.find((m) => m.role === "user")
  if (!firstUser) return fallback
  return firstUser.text.slice(0, 72)
}

/** Returns the initial {sessions, activeId, messages} — migrating the legacy
 *  single-conversation key on first load and seeding an empty session if needed. */
function bootstrapSessions() {
  let sessions: SessionMeta[] = []
  try {
    sessions = JSON.parse(localStorage.getItem(SESS_KEY) || "[]")
  } catch {
    sessions = []
  }
  let activeId = localStorage.getItem(ACTIVE_KEY) || ""

  if (sessions.length === 0) {
    const legacy = localStorage.getItem(LEGACY_KEY)
    const id = genId()
    let msgs: Message[] = []
    if (legacy) {
      msgs = reviveMessages(legacy)
      localStorage.setItem(msgKey(id), JSON.stringify(msgs))
      localStorage.removeItem(LEGACY_KEY)
    }
    sessions = [
      { id, title: titleFromMessages(msgs), updatedAt: Date.now() },
    ]
    activeId = id
    localStorage.setItem(SESS_KEY, JSON.stringify(sessions))
    localStorage.setItem(ACTIVE_KEY, activeId)
  } else if (!activeId || !sessions.some((s) => s.id === activeId)) {
    activeId = sessions[0].id
    localStorage.setItem(ACTIVE_KEY, activeId)
  }

  return { sessions, activeId, messages: loadSessionMessages(activeId) }
}
const STAGE_ORDER: StageName[] = ["generate", "search", "reflect", "synthesize"]

const freshStages = (): Stage[] =>
  STAGE_ORDER.map((name) => ({ name, status: "pending" as StageStatus }))

/** Build a compact history string from the last few completed turns. */
function buildHistory(messages: Message[]): string {
  const turns = messages
    .filter((m) => m.text && !m.error)
    .slice(-4) // last two Q/A pairs
    .map((m) => `${m.role === "user" ? "User" : "PROOF"}: ${m.text}`)
  return turns.join("\n")
}

export default function useStream() {
  // One-time bootstrap: load sessions list + the active session's messages,
  // migrating any legacy single-conversation storage.
  const bootRef = useRef(bootstrapSessions())
  const [sessions, setSessions] = useState<SessionMeta[]>(bootRef.current.sessions)
  const [activeSessionId, setActiveSessionId] = useState<string>(
    bootRef.current.activeId,
  )
  const [messages, setMessages] = useState<Message[]>(bootRef.current.messages)
  const [isLoading, setIsLoading] = useState(false)
  const [controls, setControlsState] = useState<Controls>(loadControls)
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const esRef = useRef<EventSource | null>(null)
  const activeAssistantRef = useRef<string | null>(null)
  // Lets the teardown paths (stop / switch / new / clear / next run) cancel the
  // active run's cold-start timers so they can't fire against superseded state.
  const streamCleanupRef = useRef<(() => void) | null>(null)

  const setControls = useCallback((c: Controls) => {
    setControlsState(c)
    try {
      localStorage.setItem(CONTROLS_KEY, JSON.stringify(c))
    } catch {
      /* ignore */
    }
  }, [])

  // Persist the active session's messages (skip mid-stream); also keep the
  // session's title (from first user msg) and updatedAt fresh.
  useEffect(() => {
    if (isLoading) return
    try {
      localStorage.setItem(
        msgKey(activeSessionId),
        JSON.stringify(messages.slice(-30)),
      )
    } catch (e) {
      // Most likely the storage quota — we already cap to the last 30 turns, so
      // this is rare, but warn rather than lose history completely silently.
      if (
        e instanceof DOMException &&
        (e.name === "QuotaExceededError" ||
          e.name === "NS_ERROR_DOM_QUOTA_REACHED")
      ) {
        console.warn(
          "PROOF: localStorage is full — the most recent history may not be saved.",
        )
      }
    }
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === activeSessionId)
      if (idx < 0) return prev
      const title = titleFromMessages(messages, prev[idx].title)
      const next = [...prev]
      next[idx] = { ...next[idx], title, updatedAt: Date.now() }
      next.sort((a, b) => b.updatedAt - a.updatedAt)
      return next
    })
  }, [messages, activeSessionId, isLoading])

  useEffect(() => {
    try {
      localStorage.setItem(SESS_KEY, JSON.stringify(sessions))
    } catch {
      /* ignore */
    }
  }, [sessions])

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_KEY, activeSessionId)
    } catch {
      /* ignore */
    }
  }, [activeSessionId])

  const patch = useCallback((id: string, fn: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)))
  }, [])

  // Cancel any pending stream timers / connection if the hook unmounts.
  useEffect(() => {
    return () => {
      streamCleanupRef.current?.()
      esRef.current?.close()
    }
  }, [])

  const run = useCallback(
    (
      question: string,
      history: string,
      assistantId: string,
      opts: { nocache?: boolean } = {},
    ) => {
      // Cancel any timers still pending from a prior run before starting a new one.
      streamCleanupRef.current?.()
      const base = import.meta.env.VITE_API_BASE_URL || ""
      const c = controlsRef.current
      const params = new URLSearchParams({
        question,
        max_words: String(c.maxWords),
        max_sources: String(c.maxSources),
        fmt: c.fmt,
      })
      if (history) params.set("history", history)
      if (c.recency !== "any") params.set("recency", c.recency)
      if (opts.nocache) params.set("nocache", "1")
      const es = new EventSource(`${base}/api/stream?${params.toString()}`)
      esRef.current = es
      activeAssistantRef.current = assistantId
      let buffer = ""
      let gotData = false

      // A late event from a stream the user has since superseded (switched
      // session, hit Stop, asked again) must not clobber the new state.
      const isStale = () => activeAssistantRef.current !== assistantId

      // Cold-start handling: the free-tier backend (HF Spaces) sleeps when
      // idle, so the *first* request can take many seconds just to connect.
      // Surface a "waking up" hint after a short grace period, and bound the
      // total wait so the UI never hangs forever on a dead connection.
      let wakeTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (!gotData && !isStale())
          patch(assistantId, (m) => ({ ...m, waking: true }))
      }, 3500)
      let hardTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (gotData) return
        clearTimers()
        es.close()
        if (isStale()) return // superseded — leave the new stream's state alone
        patch(assistantId, (m) => ({
          ...m,
          isStreaming: false,
          waking: false,
          error: true,
          text: "The server didn't respond in time — it may be waking from sleep. Please try again in a moment.",
        }))
        setIsLoading(false)
        activeAssistantRef.current = null
      }, 75000)

      const clearTimers = () => {
        if (wakeTimer) {
          clearTimeout(wakeTimer)
          wakeTimer = null
        }
        if (hardTimer) {
          clearTimeout(hardTimer)
          hardTimer = null
        }
      }
      // Expose timer-cancellation to the teardown paths.
      streamCleanupRef.current = clearTimers
      // First byte from the server → it's awake and streaming. Drop the
      // cold-start timers and clear the hint.
      const markLive = () => {
        if (!gotData) {
          gotData = true
          patch(assistantId, (m) => (m.waking ? { ...m, waking: false } : m))
        }
        clearTimers()
      }
      const finalize = (asError: boolean) => {
        clearTimers()
        es.close()
        if (isStale()) return // superseded — leave the new stream's state alone
        patch(assistantId, (m) =>
          m.text || !asError
            ? { ...m, isStreaming: false, waking: false }
            : {
                ...m,
                isStreaming: false,
                waking: false,
                error: true,
                text: "The research run hit a snag. Please try again.",
              },
        )
        setIsLoading(false)
        activeAssistantRef.current = null
      }

      es.addEventListener("stage", (e: MessageEvent) => {
        markLive()
        if (isStale()) return
        try {
          const { name, status, meta } = JSON.parse(e.data)
          patch(assistantId, (m) => ({
            ...m,
            stages: (m.stages ?? freshStages()).map((s) =>
              s.name === name
                ? { ...s, status, docs: meta?.docs ?? s.docs }
                : s,
            ),
          }))
        } catch {
          /* ignore */
        }
      })

      es.addEventListener("queries", (e: MessageEvent) => {
        markLive()
        if (isStale()) return
        try {
          patch(assistantId, (m) => ({ ...m, queries: JSON.parse(e.data).value }))
        } catch {
          /* ignore */
        }
      })

      es.addEventListener("coverage", (e: MessageEvent) => {
        markLive()
        if (isStale()) return
        try {
          patch(assistantId, (m) => ({ ...m, coverage: JSON.parse(e.data).value }))
        } catch {
          /* ignore */
        }
      })

      es.addEventListener("followups", (e: MessageEvent) => {
        markLive()
        if (isStale()) return
        try {
          patch(assistantId, (m) => ({ ...m, followups: JSON.parse(e.data).value }))
        } catch {
          /* ignore */
        }
      })

      es.addEventListener("token", (e: MessageEvent) => {
        markLive()
        if (isStale()) return
        try {
          const { text } = JSON.parse(e.data)
          buffer += text
          patch(assistantId, (m) => ({
            ...m,
            text: buffer,
            isStreaming: true,
            waking: false,
          }))
        } catch {
          /* ignore */
        }
      })

      es.addEventListener("done", (e: MessageEvent) => {
        clearTimers()
        if (isStale()) {
          es.close()
          return // superseded — leave the new stream's state alone
        }
        try {
          const { answer, citations, cached, coverage, followups, trace_id } =
            JSON.parse(e.data)
          patch(assistantId, (m) => ({
            ...m,
            text: answer || buffer,
            citations: citations || [],
            cached: !!cached,
            coverage: coverage ?? m.coverage,
            followups: followups ?? m.followups,
            traceId: trace_id ?? m.traceId,
            isStreaming: false,
            waking: false,
          }))
        } catch {
          /* ignore */
        }
        es.close()
        setIsLoading(false)
        activeAssistantRef.current = null
      })

      es.addEventListener("error", (e: Event) => {
        // A server-sent `event: error` frame carries data; a bare connection
        // error does not — the two need different handling.
        const data = (e as MessageEvent).data
        if (data) {
          finalize(true) // server reported a failure → stop here
          return
        }
        if (!gotData && es.readyState === EventSource.CONNECTING) {
          // Transient connection error before any data arrived — almost always
          // the backend still booting from sleep. EventSource auto-retries, so
          // we show the waking hint and let it (hardTimer bounds the wait). We
          // deliberately do NOT close here, and only allow this *before* data,
          // so a mid-stream drop can never silently re-run the whole query.
          if (!isStale()) patch(assistantId, (m) => ({ ...m, waking: true }))
          return
        }
        finalize(true)
      })
    },
    [patch],
  )

  const ask = useCallback(
    (question: string, opts: { nocache?: boolean } = {}) => {
      if (isLoading) return
      const q = question.trim()
      if (!q) return
      setIsLoading(true)

      const userMsg: Message = {
        id: genId(),
        role: "user",
        text: q,
        timestamp: new Date(),
      }
      const assistantId = genId()
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        text: "",
        timestamp: new Date(),
        isStreaming: true,
        stages: freshStages(),
      }

      let history = ""
      setMessages((prev) => {
        history = buildHistory(prev)
        return [...prev, userMsg, assistantMsg]
      })
      run(q, history, assistantId, opts)
    },
    [isLoading, run],
  )

  const stopStream = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    streamCleanupRef.current?.()
    setIsLoading(false)
    const id = activeAssistantRef.current
    activeAssistantRef.current = null
    if (id) {
      patch(id, (m) => ({
        ...m,
        isStreaming: false,
        stopped: true,
        text: m.text || "Stopped.",
      }))
    }
  }, [patch])

  const regenerate = useCallback(() => {
    if (isLoading) return
    // find the last user message, drop everything after it, re-ask
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user")
    if (lastUserIdx === -1) return
    const idx = messages.length - 1 - lastUserIdx
    const q = messages[idx].text
    setMessages(messages.slice(0, idx)) // also removes the user msg; ask re-adds it
    // Bypass the cache so the user sees a genuinely fresh research run instead
    // of the same answer flashing back with a `cached` badge.
    setTimeout(() => ask(q, { nocache: true }), 0)
  }, [isLoading, messages, ask])

  const clearMessages = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    streamCleanupRef.current?.()
    activeAssistantRef.current = null
    setIsLoading(false)
    setMessages([])
    try {
      localStorage.removeItem(msgKey(activeSessionId))
    } catch {
      /* ignore */
    }
  }, [activeSessionId])

  // ── session actions ──────────────────────────────────────────────────────
  const newSession = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    streamCleanupRef.current?.()
    activeAssistantRef.current = null
    setIsLoading(false)
    const id = genId()
    const meta: SessionMeta = {
      id,
      title: "New session",
      updatedAt: Date.now(),
    }
    setSessions((prev) => [meta, ...prev])
    setActiveSessionId(id)
    setMessages([])
  }, [])

  const switchSession = useCallback(
    (id: string) => {
      if (id === activeSessionId) return
      esRef.current?.close()
      esRef.current = null
      streamCleanupRef.current?.()
      activeAssistantRef.current = null
      setIsLoading(false)
      setActiveSessionId(id)
      setMessages(loadSessionMessages(id))
    },
    [activeSessionId],
  )

  const deleteSession = useCallback(
    (id: string) => {
      try {
        localStorage.removeItem(msgKey(id))
      } catch {
        /* ignore */
      }
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== id)
        if (id === activeSessionId) {
          // pick the next session, or create a blank one if we just removed the last
          if (remaining.length > 0) {
            setActiveSessionId(remaining[0].id)
            setMessages(loadSessionMessages(remaining[0].id))
            return remaining
          }
          const fresh: SessionMeta = {
            id: genId(),
            title: "New session",
            updatedAt: Date.now(),
          }
          setActiveSessionId(fresh.id)
          setMessages([])
          return [fresh]
        }
        return remaining
      })
    },
    [activeSessionId],
  )

  const renameSession = useCallback((id: string, title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: title.trim() || s.title } : s)),
    )
  }, [])

  return {
    messages,
    ask,
    isLoading,
    stopStream,
    regenerate,
    clearMessages,
    controls,
    setControls,
    sessions,
    activeSessionId,
    newSession,
    switchSession,
    deleteSession,
    renameSession,
  }
}
