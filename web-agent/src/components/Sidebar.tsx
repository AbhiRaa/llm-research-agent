import { useEffect, useRef, useState } from "react"
import { Plus, Trash2, Pencil, X } from "lucide-react"
import type { SessionMeta } from "../hooks/useStream"

interface SidebarProps {
  open: boolean
  onClose: () => void
  sessions: SessionMeta[]
  activeId: string
  onNew: () => void
  onSwitch: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

function relTime(ts: number): string {
  const secs = Math.max(0, (Date.now() - ts) / 1000)
  if (secs < 60) return "just now"
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default function Sidebar({
  open,
  onClose,
  sessions,
  activeId,
  onNew,
  onSwitch,
  onDelete,
  onRename,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  // Esc closes the drawer
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) setEditingId(null)
        else onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, editingId])

  return (
    <>
      {/* backdrop */}
      <div
        className="no-print fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: "rgba(0,0,0,0.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="no-print fixed left-0 top-0 z-50 flex h-full w-[320px] max-w-[85vw] flex-col"
        style={{
          background: "var(--paper)",
          borderRight: "3px solid var(--ink)",
          boxShadow: open ? "8px 0 0 var(--blue)" : "none",
          transform: `translateX(${open ? "0" : "-100%"})`,
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        aria-label="Past sessions"
        aria-hidden={!open}
      >
        <div
          className="flex items-center justify-between border-b-2 px-5 pb-3 pt-4"
          style={{ borderColor: "var(--ink)" }}
        >
          <h2
            className="riso-title text-2xl"
            data-text="Archive"
            style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            Archive
          </h2>
          <button
            onClick={onClose}
            aria-label="Close sessions"
            className="ring-riso p-1"
            style={{ color: "var(--ink)" }}
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="px-5 pt-3">
          <button
            onClick={onNew}
            className="press-btn ring-riso touch-target mono inline-flex h-9 w-full items-center justify-center gap-2 px-3 text-[0.72rem] uppercase tracking-widest"
            style={{ background: "var(--flame)", color: "var(--paper)" }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> New session
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="list-clean flex flex-col gap-1">
            {sessions.map((s) => {
              const isActive = s.id === activeId
              const isEditing = editingId === s.id
              return (
                <li key={s.id}>
                  <div
                    className="group relative flex items-center gap-1 px-2 py-2 transition-colors"
                    style={{
                      background: isActive ? "var(--paper-2)" : "transparent",
                      borderLeft: `3px solid ${isActive ? "var(--flame)" : "transparent"}`,
                    }}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => {
                          onRename(s.id, draft)
                          setEditingId(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRename(s.id, draft)
                            setEditingId(null)
                          }
                        }}
                        className="flex-1 bg-transparent px-1 py-0.5 outline-none"
                        style={{
                          fontFamily: "var(--font-body)",
                          color: "var(--ink)",
                          border: "1px solid var(--blue)",
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => onSwitch(s.id)}
                        className="ring-riso min-w-0 flex-1 text-left"
                        title={s.title}
                      >
                        <span
                          className="block truncate text-[0.95rem]"
                          style={{
                            fontFamily: "var(--font-body)",
                            color: "var(--ink)",
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          {s.title}
                        </span>
                        <span
                          className="mono block text-[0.66rem]"
                          style={{ color: "var(--ink-mute)" }}
                        >
                          {relTime(s.updatedAt)}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDraft(s.title)
                        setEditingId(s.id)
                      }}
                      aria-label="Rename session"
                      className="ring-riso p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--ink-mute)" }}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                    <button
                      onClick={() => onDelete(s.id)}
                      aria-label="Delete session"
                      className="ring-riso p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--flame)" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
