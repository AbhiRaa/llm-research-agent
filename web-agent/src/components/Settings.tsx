import { useEffect, useRef, useState } from "react"
import { SlidersHorizontal, Minus, Plus } from "lucide-react"
import type { Controls, AnswerFormat, Recency } from "../hooks/useStream"

const LENGTHS: [string, number][] = [
  ["Brief", 40],
  ["Standard", 80],
  ["Detailed", 150],
]
const FORMATS: [string, AnswerFormat][] = [
  ["Prose", "prose"],
  ["Bullets", "bullets"],
  ["TL;DR", "tldr"],
]
const RECENCY: [string, Recency][] = [
  ["Any", "any"],
  ["24h", "day"],
  ["Week", "week"],
  ["Month", "month"],
]

const lengthLabel = (w: number) =>
  LENGTHS.find(([, v]) => v === w)?.[0] ?? `${w}w`

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly [string, T][]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      className="flex border-2"
      style={{ borderColor: "var(--ink)", background: "var(--paper)" }}
    >
      {options.map(([label, val], i) => {
        const active = val === value
        return (
          <button
            key={label}
            onClick={() => onChange(val)}
            className="ring-riso mono flex-1 px-2 py-1.5 text-[0.7rem] uppercase tracking-wider transition-colors"
            style={{
              background: active ? "var(--ink)" : "transparent",
              color: active ? "var(--paper)" : "var(--ink-soft)",
              borderLeft: i ? "1px solid var(--rule)" : "none",
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="kicker" style={{ color: "var(--ink-mute)" }}>
        {label}
      </span>
      {children}
    </div>
  )
}

export default function Settings({
  controls,
  setControls,
}: {
  controls: Controls
  setControls: (c: Controls) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const set = (p: Partial<Controls>) => setControls({ ...controls, ...p })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Answer settings"
        title="Answer settings"
        className="clear-btn ring-riso flex h-9 items-center gap-2 px-3"
      >
        <SlidersHorizontal className="h-[15px] w-[15px]" strokeWidth={2} />
        <span className="kicker hidden sm:inline">
          {lengthLabel(controls.maxWords)} · {controls.maxSources} src
        </span>
      </button>

      {open && (
        <div
          className="paper-card riso-in p-4"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "0.5rem",
            width: "min(18rem, calc(100vw - 2.5rem))",
            zIndex: 50,
            boxShadow: "5px 5px 0 var(--blue)",
          }}
          role="dialog"
          aria-label="Answer settings"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="kicker" style={{ color: "var(--flame)" }}>
              Print settings
            </span>
          </div>
          <div className="flex flex-col gap-4">
            <Row label="Answer length">
              <Segmented
                options={LENGTHS}
                value={controls.maxWords}
                onChange={(v) => set({ maxWords: v })}
              />
            </Row>

            <Row label={`Sources · ${controls.maxSources}`}>
              <div
                className="flex items-center justify-between border-2 px-2 py-1"
                style={{ borderColor: "var(--ink)", background: "var(--paper)" }}
              >
                <button
                  onClick={() => set({ maxSources: Math.max(1, controls.maxSources - 1) })}
                  className="ring-riso p-1"
                  style={{ color: "var(--ink)" }}
                  aria-label="Fewer sources"
                >
                  <Minus className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className="h-2 w-2"
                      style={{
                        background:
                          n <= controls.maxSources ? "var(--flame)" : "var(--paper-3)",
                        border: "1px solid var(--ink)",
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => set({ maxSources: Math.min(5, controls.maxSources + 1) })}
                  className="ring-riso p-1"
                  style={{ color: "var(--ink)" }}
                  aria-label="More sources"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            </Row>

            <Row label="Format">
              <Segmented
                options={FORMATS}
                value={controls.fmt}
                onChange={(v) => set({ fmt: v })}
              />
            </Row>

            <Row label="Recency">
              <Segmented
                options={RECENCY}
                value={controls.recency}
                onChange={(v) => set({ recency: v })}
              />
            </Row>
          </div>
        </div>
      )}
    </div>
  )
}
