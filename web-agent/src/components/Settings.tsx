import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  SlidersHorizontal,
  Minus,
  Plus,
  Printer,
  Download,
  Trash2,
} from "lucide-react"
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

interface SettingsProps {
  controls: Controls
  setControls: (c: Controls) => void
  onExport?: () => void
  onClearChat?: () => void
  showClear?: boolean
}

export default function Settings({
  controls,
  setControls,
  onExport,
  onClearChat,
  showClear = false,
}: SettingsProps) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Outside-click dismiss — only for the desktop popover. The mobile sheet is
  // portaled to <body> (outside `ref`) and dismisses via its own backdrop.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (isMobile) return
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [isMobile])

  // Below 640px the absolute top-right popover can overlap the hero, so render
  // it as a bottom sheet instead.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)")
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  // Esc closes the popover (keyboard a11y).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const set = (p: Partial<Controls>) => setControls({ ...controls, ...p })

  // The panel content is shared verbatim between the desktop popover and the
  // mobile bottom sheet.
  const panel = (
    <>
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

        {/* Page actions — Print / Export / Clear live here so the header
            stays minimal and these stay reachable on every viewport. */}
        <hr className="rule-double mt-1" style={{ borderColor: "var(--ink)" }} />
        <Row label="Page actions">
          <div className="flex flex-col gap-2">
            <ActionButton
              icon={<Printer className="h-[15px] w-[15px]" strokeWidth={2.25} />}
              label="Print proof"
              onClick={() => window.print()}
            />
            {onExport && (
              <ActionButton
                icon={<Download className="h-[15px] w-[15px]" strokeWidth={2.25} />}
                label="Export as Markdown"
                onClick={onExport}
              />
            )}
            {showClear && onClearChat && (
              <ActionButton
                icon={<Trash2 className="h-[15px] w-[15px]" strokeWidth={2.25} />}
                label="Clear conversation"
                onClick={onClearChat}
                danger
              />
            )}
          </div>
        </Row>
      </div>
    </>
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Answer settings"
        title="Answer settings"
        className="clear-btn ring-riso touch-target flex h-9 items-center gap-2 px-3"
      >
        <SlidersHorizontal className="h-[15px] w-[15px]" strokeWidth={2} />
        <span className="kicker hidden sm:inline">
          {lengthLabel(controls.maxWords)} · {controls.maxSources} src
        </span>
      </button>

      {/* Desktop: anchored popover */}
      {open && !isMobile && (
        <div
          className="paper-card riso-in p-4"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "0.5rem",
            width: "min(18rem, calc(100vw - 2.5rem))",
            maxHeight: "min(36rem, calc(100vh - 6rem))",
            overflowY: "auto",
            zIndex: 50,
            boxShadow: "5px 5px 0 var(--blue)",
          }}
          role="dialog"
          aria-label="Answer settings"
        >
          {panel}
        </div>
      )}

      {/* Mobile: bottom sheet, portaled to <body> so the header's
          backdrop-filter containing block can't anchor or clip it. */}
      {open &&
        isMobile &&
        createPortal(
          <>
            <div
              onClick={() => setOpen(false)}
              aria-hidden="true"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(20,20,20,0.4)",
                zIndex: 60,
              }}
            />
            <div
              className="paper-card riso-in"
              role="dialog"
              aria-label="Answer settings"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                width: "100%",
                maxHeight: "min(85vh, 40rem)",
                overflowY: "auto",
                zIndex: 61,
                padding: "1rem",
                paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                boxShadow: "0 -5px 0 var(--blue)",
              }}
            >
              <div className="mb-3 flex justify-center">
                <span
                  style={{
                    width: "2.5rem",
                    height: "3px",
                    background: "var(--ink)",
                    opacity: 0.4,
                  }}
                />
              </div>
              {panel}
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}

/** A compact row button matching the riso clear-btn treatment. */
function ActionButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="clear-btn ring-riso touch-target mono flex h-9 w-full items-center gap-2 px-3 text-[0.72rem] uppercase tracking-widest"
      style={{ color: danger ? "var(--flame)" : "var(--ink)" }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
