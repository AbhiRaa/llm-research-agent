import type { Stage } from "../hooks/useStream"

const LABELS: Record<string, string> = {
  generate: "Generate",
  search: "Search",
  reflect: "Reflect",
  synthesize: "Synthesize",
}

/**
 * Live "press run" — reflects the REAL backend pipeline stages streamed over
 * SSE (generate → search → reflect → synthesize), not a timer.
 */
export default function Pipeline({ stages }: { stages: Stage[] }) {
  return (
    <div
      className="paper-card riso-in px-5 py-4 sm:px-6"
      role="status"
      aria-live="polite"
      aria-label="Researching"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="roller h-3 w-10 border-2" style={{ borderColor: "var(--ink)" }} />
        <span className="kicker" style={{ color: "var(--ink)" }}>
          On press · researching
        </span>
      </div>
      <ol className="list-clean flex flex-col gap-2.5 sm:flex-row sm:gap-2">
        {stages.map((s, i) => {
          const done = s.status === "done"
          const running = s.status === "running"
          return (
            <li key={s.name} className="flex flex-1 items-center gap-2">
              <span
                className="mono flex h-6 w-6 shrink-0 items-center justify-center border-2 text-[0.7rem] font-bold"
                style={{
                  borderColor: "var(--ink)",
                  background: done
                    ? "var(--blue)"
                    : running
                      ? "var(--flame)"
                      : "var(--paper)",
                  color: done || running ? "var(--paper)" : "var(--ink-mute)",
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`mono text-[0.68rem] uppercase tracking-[0.18em] ${running ? "stage-active" : ""}`}
                  style={{ color: done || running ? "var(--ink)" : "var(--ink-mute)" }}
                >
                  {LABELS[s.name]}
                  {s.name === "search" && done && s.docs != null && (
                    <span style={{ color: "var(--ink-mute)" }}> · {s.docs} docs</span>
                  )}
                </div>
                <div
                  className="mt-1 h-[3px] w-full overflow-hidden"
                  style={{ background: "var(--paper-3)" }}
                >
                  <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{
                      width: done ? "100%" : running ? "60%" : "0%",
                      background: done ? "var(--blue)" : "var(--flame)",
                    }}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
