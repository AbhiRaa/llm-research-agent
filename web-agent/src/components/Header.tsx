import { Moon, Sun, Monitor, PanelLeft } from "lucide-react"
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

// Cycle order: clicking the theme button advances light → dark → system → light.
const THEME_NEXT: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
}
const THEME_ICON: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}
const THEME_LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
}

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
  const ThemeIcon = THEME_ICON[theme]
  const nextTheme = THEME_NEXT[theme]

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
          <div className="flex items-end gap-4 sm:gap-5">
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

            {/* Single cycling theme button: icon shows current state, click
                advances to the next one. Far less visual noise than the
                previous 3-cell segmented control. */}
            <button
              onClick={() => setTheme(nextTheme)}
              title={`Theme: ${THEME_LABEL[theme]} (tap for ${THEME_LABEL[nextTheme]})`}
              aria-label={`Theme: ${THEME_LABEL[theme]}. Tap to switch to ${THEME_LABEL[nextTheme]}.`}
              className="clear-btn ring-riso touch-target flex h-9 items-center justify-center px-2.5"
            >
              <ThemeIcon className="h-[15px] w-[15px]" strokeWidth={2.25} />
            </button>

            {/* Print / Export / Clear live inside Settings now (Page actions)
                so the header stays minimal and they're reachable on every
                viewport. */}
            <Settings
              controls={controls}
              setControls={setControls}
              onExport={onExport}
              onClearChat={onClearChat}
              showClear={showClearButton}
            />
          </div>
        </div>
        <hr className="rule-double" />
      </div>
    </header>
  )
}
