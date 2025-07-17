import { useState, useEffect } from "react"
import Header from "./components/Header"
import Chat from "./components/Chat"
import useStream from "./hooks/useStream"

type Theme = "light" | "dark" | "system"

export default function App() {
  const [theme, setTheme] = useState<Theme>("system")
  const { messages, ask, clearMessages } = useStream()

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Header 
        theme={theme} 
        setTheme={setTheme} 
        onClearChat={clearMessages}
        showClearButton={messages.length > 0}
      />
      <main className="flex-1 overflow-hidden">
        <Chat messages={messages} ask={ask} />
      </main>
    </div>
  )
}
