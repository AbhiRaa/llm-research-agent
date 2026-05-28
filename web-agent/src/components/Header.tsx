import { Moon, Sun, Monitor, Trash2, Download, Printer, PanelLeft } from "lucide-react"
import Settings from "./Settings"
import type { Controls } from "../hooks/useStream"

type Theme = "light" | "dark" | "system"

interface HeaderProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  onClearChat?: () => void
  onExport?: () => void
  onToggleSidebar?: () => void
  showClearButton?: boolean
  busy?: boolean
  controls: Controls
  setControls: (c: Controls) => void
}

const edition = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
})

export default function Header({
  theme,
  setTheme,
  onClearChat,
  onExport,
  onToggleSidebar,
  showClearButton = false,
  busy = false,
  controls,
  setControls,
}: HeaderProps) {
  const modes: { id: Theme; icon: typeof Sun; label: string }[] = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "System" },
  ]

  return (
    <header className="sticky top-0 z-40 backdrop-blur-[2px]">
      <div
        className="halftone-flame halftone absolute inset-0 -z-10 opacity-[0.18]"
        aria-hidden="true"
        style={{ background: "var(--paper)" }}
      />
      <div className="mx-auto w-full max-w-[1180px] px-5 pt-4 sm:px-8">
        <div className="flex items-end justify-between gap-4 pb-2">
          {/* Masthead */}
          <div className="flex items-end gap-3 sm:gap-4">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                aria-label="Open sessions"
                title="Sessions"
                className="clear-btn ring-riso touch-target no-print mb-0.5 flex h-9 items-center justify-center px-2.5"
              >
                <PanelLeft className="h-[15px] w-[15px]" strokeWidth={2} />
              </button>
            )}
            <div
              className="relative flex h-11 w-11 shrink-0 items-center justify-center border-2 sm:h-12 sm:w-12"
              style={{ borderColor: "var(--ink)", background: "var(--paper-2)" }}
            >
              <span
                className="absolute h-5 w-5 rounded-full sm:h-[22px] sm:w-[22px]"
                style={{ background: "var(--blue)", left: "8px", top: "10px" }}
              />
              <span
                className="overprint absolute h-5 w-5 rounded-full sm:h-[22px] sm:w-[22px]"
                style={{ background: "var(--flame)", left: "14px", top: "10px" }}
              />
            </div>
            <div className="leading-none">
              <h1
                className="riso-title text-3xl sm:text-4xl"
                data-text="PROOF"
                style={{ fontWeight: 800, letterSpacing: "-0.03em" }}
              >
                PROOF
              </h1>
              <p
                className="kicker mt-1 hidden sm:block"
                style={{ color: "var(--ink-mute)" }}
              >
                Evidence-led research · Nº 01
              </p>
            </div>
          </div>

          {/* Status + controls */}
          <div className="no-print flex items-center gap-2 sm:gap-4">
            <div
              className="mono hidden items-center gap-3 text-[0.7rem] md:flex"
              style={{ color: "var(--ink-mute)" }}
            >
              <span className="uppercase tracking-widest">{edition}</span>
              <span style={{ color: "var(--rule)" }}>|</span>
              <span className="inline-flex items-center gap-1.5 uppercase tracking-widest">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${busy ? "stage-active" : ""}`}
                  style={{ background: busy ? "var(--flame)" : "var(--blue)" }}
                />
                {busy ? "on press" : "ready"}
              </span>
            </div>

            <div
              className="relative flex border-2"
              style={{
                borderColor: "var(--ink)",
                background: "var(--paper-2)",
                boxShadow: "3px 3px 0 var(--blue)",
              }}
              role="radiogroup"
              aria-label="Color theme"
            >
              {/* sliding ink plate */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 h-full"
                style={{
                  width: `${100 / modes.length}%`,
                  transform: `translateX(${modes.findIndex((m) => m.id === theme) * 100}%)`,
                  background: "var(--ink)",
                  transition: "transform 0.32s cubic-bezier(0.34, 1.4, 0.5, 1)",
                }}
              />
              {modes.map(({ id, icon: Icon, label }) => {
                const active = theme === id
                return (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    title={`${label} theme`}
                    aria-label={`${label} theme`}
                    role="radio"
                    aria-checked={active}
                    className="ring-riso touch-target relative z-10 flex h-9 w-9 items-center justify-center"
                    style={{
                      color: active ? "var(--paper)" : "var(--ink-soft)",
                      transition: "color 0.2s ease",
                    }}
                  >
                    <Icon
                      className="h-[15px] w-[15px]"
                      strokeWidth={2.25}
                      style={{
                        transform: active ? "scale(1.08)" : "scale(1)",
                        transition: "transform 0.2s cubic-bezier(0.34, 1.4, 0.5, 1)",
                      }}
                    />
                  </button>
                )
              })}
            </div>

            <Settings controls={controls} setControls={setControls} />

            {showClearButton && (
              <>
                <button
                  onClick={() => window.print()}
                  title="Print / save as PDF"
                  aria-label="Print this proof"
                  className="clear-btn ring-riso touch-target hidden h-9 items-center justify-center px-2.5 sm:flex"
                >
                  <Printer className="h-[15px] w-[15px]" strokeWidth={2} />
                </button>
                <button
                  onClick={onExport}
                  title="Export as Markdown"
                  aria-label="Export conversation as Markdown"
                  className="clear-btn ring-riso touch-target hidden h-9 items-center justify-center px-2.5 sm:flex"
                >
                  <Download className="h-[15px] w-[15px]" strokeWidth={2} />
                </button>
                <button
                  onClick={onClearChat}
                  title="Clear the record"
                  aria-label="Clear the record"
                  className="clear-btn ring-riso touch-target flex h-9 items-center gap-2 px-3"
                >
                  <Trash2 className="h-[15px] w-[15px]" strokeWidth={2} />
                  <span className="kicker hidden sm:inline">Clear</span>
                </button>
              </>
            )}
          </div>
        </div>
        <hr className="rule-double" />
      </div>
    </header>
  )
}
