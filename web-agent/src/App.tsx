import { useState, useEffect } from "react"
import Chat from "./components/Chat"
import { Moon, Sun, Monitor } from "lucide-react"

type Theme = "light" | "dark" | "system"

export default function App() {
  const [theme, setTheme] = useState<Theme>("system")

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
    <div className="relative h-screen overflow-hidden">
      {/* Theme Toggle */}
      <div className="fixed right-4 top-4 z-50">
        <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          <button
            onClick={() => setTheme("light")}
            className={`rounded-md p-2 transition-all ${
              theme === "light" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Sun className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`rounded-md p-2 transition-all ${
              theme === "dark" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Moon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTheme("system")}
            className={`rounded-md p-2 transition-all ${
              theme === "system" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Monitor className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Chat />
    </div>
  )
}
