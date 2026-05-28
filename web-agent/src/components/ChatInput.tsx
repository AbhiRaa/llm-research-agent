import { useEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { ArrowRight, Square, Mic, MicOff } from "lucide-react"

interface ChatInputProps {
  onSend: (q: string) => void
  isLoading?: boolean
  onStop?: () => void
}

// Web Speech API: TS dom lib doesn't declare it, and Safari only ships the
// webkit-prefixed name — treat both as opaque.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SR: any =
  typeof window !== "undefined"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition
    : undefined

export default function ChatInput({
  onSend,
  isLoading = false,
  onStop,
}: ChatInputProps) {
  const [val, setVal] = useState("")
  const [recording, setRecording] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // The Web Speech API instance — typed loosely because TS dom lib lacks it.
  const recRef = useRef<unknown>(null)

  const send = () => {
    const q = val.trim()
    if (q && !isLoading) {
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

  // autosize
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [val])

  // ⌘/Ctrl+K focus from anywhere
  useEffect(() => {
    const focus = () => textareaRef.current?.focus()
    window.addEventListener("proof:focus-composer", focus)
    return () => window.removeEventListener("proof:focus-composer", focus)
  }, [])

  const startDictation = () => {
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = navigator.language || "en-US"
    const base = val
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join("")
        .trim()
      if (!transcript) return
      const sep = base && !base.endsWith(" ") ? " " : ""
      setVal(base + sep + transcript)
    }
    rec.onend = () => setRecording(false)
    rec.onerror = () => setRecording(false)
    try {
      rec.start()
      recRef.current = rec
      setRecording(true)
    } catch {
      setRecording(false)
    }
  }
  const stopDictation = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(recRef.current as any)?.stop?.()
    setRecording(false)
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-4 sm:px-8 sm:py-5">
      <div className="flex items-stretch gap-3">
        <div
          className="paper-card flex flex-1 items-end gap-3 px-4 py-3 sm:px-5"
          style={{ boxShadow: "5px 5px 0 var(--blue)" }}
        >
          <span
            className="mono mb-1.5 shrink-0 select-none text-sm font-bold"
            style={{ color: "var(--flame)" }}
            aria-hidden="true"
          >
            &gt;
          </span>
          <label htmlFor="composer" className="sr-only">
            Ask anything
          </label>
          <textarea
            id="composer"
            ref={textareaRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Set your query…"
            disabled={isLoading}
            className="mono w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:opacity-60 disabled:opacity-50"
            style={{ color: "var(--ink)", caretColor: "var(--flame)", minHeight: "28px" }}
          />
          {SR && (
            <button
              onClick={recording ? stopDictation : startDictation}
              disabled={isLoading}
              aria-label={recording ? "Stop dictation" : "Dictate"}
              title={recording ? "Stop dictation" : "Dictate"}
              className="ring-riso mb-1 shrink-0 p-1.5 transition-colors"
              style={{
                color: recording ? "var(--paper)" : "var(--ink-soft)",
                background: recording ? "var(--flame)" : "transparent",
                border: "2px solid var(--ink)",
              }}
            >
              {recording ? (
                <MicOff className="h-4 w-4" strokeWidth={2.25} />
              ) : (
                <Mic className="h-4 w-4" strokeWidth={2.25} />
              )}
            </button>
          )}
        </div>

        {isLoading ? (
          <button
            onClick={onStop}
            aria-label="Stop the press"
            className="press-btn ring-riso flex w-14 shrink-0 items-center justify-center sm:w-16"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            <Square className="h-5 w-5 fill-current" strokeWidth={0} />
          </button>
        ) : (
          <button
            onClick={send}
            disabled={!val.trim()}
            aria-label="Run the press"
            className="press-btn ring-riso flex w-14 shrink-0 items-center justify-center sm:w-16"
            style={{ background: "var(--flame)", color: "var(--paper)" }}
          >
            <ArrowRight className="h-6 w-6" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <p className="kicker mt-3 text-center" style={{ color: "var(--ink-mute)" }}>
        <kbd className="mono">Enter</kbd> to run ·{" "}
        <kbd className="mono">⇧ Enter</kbd> new line ·{" "}
        <kbd className="mono">⌘K</kbd> focus ·{" "}
        <kbd className="mono">Esc</kbd> stop
      </p>
    </div>
  )
}
