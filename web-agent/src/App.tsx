import { useEffect, useState } from "react"
import Header from "./components/Header"
import Chat from "./components/Chat"
import Sidebar from "./components/Sidebar"
import SharedView from "./components/SharedView"
import useStream from "./hooks/useStream"
import { exportChatAsMarkdown } from "./utils/exportChat"

// /share/<id> renders the read-only published proof — no router needed.
const SHARE_MATCH = window.location.pathname.match(/^\/share\/([A-Za-z0-9_-]+)/)

type Theme = "light" | "dark" | "system"
const THEME_KEY = "proof-theme"

function applyTheme(theme: Theme) {
  const root = window.document.documentElement
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  root.classList.remove("light", "dark")
  root.classList.add(dark ? "dark" : "light")
  root.style.colorScheme = dark ? "dark" : "light"
}

export default function App() {
  // /share/<id> short-circuits the whole chat app (read-only proof view)
  if (SHARE_MATCH) return <SharedView id={SHARE_MATCH[1]} />
  return <ChatApp />
}

function ChatApp() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || "system",
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const {
    messages,
    ask,
    clearMessages,
    isLoading,
    stopStream,
    regenerate,
    controls,
    setControls,
    sessions,
    activeSessionId,
    newSession,
    switchSession,
    deleteSession,
    renameSession,
  } = useStream()

  // persist + apply theme, and track system changes when in "system" mode
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(THEME_KEY, theme)
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])

  // keyboard: ⌘/Ctrl+K focuses the composer, Esc stops a running press
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("proof:focus-composer"))
      }
      if (e.key === "Escape" && isLoading) stopStream()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isLoading, stopStream])

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="grain no-print" aria-hidden="true" />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        activeId={activeSessionId}
        onNew={() => {
          newSession()
          setSidebarOpen(false)
        }}
        onSwitch={(id) => {
          switchSession(id)
          setSidebarOpen(false)
        }}
        onDelete={deleteSession}
        onRename={renameSession}
      />
      <Header
        theme={theme}
        setTheme={setTheme}
        onClearChat={clearMessages}
        onExport={() => exportChatAsMarkdown(messages)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        showClearButton={messages.length > 0}
        busy={isLoading}
        controls={controls}
        setControls={setControls}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Chat
          messages={messages}
          ask={ask}
          isLoading={isLoading}
          onStop={stopStream}
          onRegenerate={regenerate}
        />
      </main>
    </div>
  )
}
