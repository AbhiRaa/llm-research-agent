import { Moon, Sun, Monitor, SearchCheckIcon, Circle, Trash2 } from "lucide-react"

type Theme = "light" | "dark" | "system"

interface HeaderProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  onClearChat?: () => void
  showClearButton?: boolean
}

export default function Header({ theme, setTheme, onClearChat, showClearButton = false }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/20 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 dark:border-slate-700/20 dark:bg-slate-800/80 dark:supports-[backdrop-filter]:bg-slate-800/80">
      <div className="w-full py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
              <SearchCheckIcon className="h-8 w-8 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Search Assistant
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  AI-powered web search
                </p>
                <div className="flex items-center gap-1.5">
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Ready
                  </span>
                </div>
              </div>
            </div>
            <div className="sm:hidden">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Search Assistant
              </h1>
            </div>
          </div>

          {/* Right side - Theme Toggle and Clear Button */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200/50 bg-white/70 backdrop-blur-sm p-1.5 shadow-lg ring-1 ring-black/5 dark:border-slate-700/50 dark:bg-slate-800/70 dark:ring-white/10">
            <button
              onClick={() => setTheme("light")}
              className={`rounded-lg p-2.5 transition-all duration-200 ${
                theme === "light" 
                  ? "bg-slate-900 text-white shadow-lg" 
                  : "text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
              }`}
              title="Light mode"
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`rounded-lg p-2.5 transition-all duration-200 ${
                theme === "dark" 
                  ? "bg-slate-900 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900" 
                  : "text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
              }`}
              title="Dark mode"
            >
              <Moon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme("system")}
              className={`rounded-lg p-2.5 transition-all duration-200 ${
                theme === "system" 
                  ? "bg-slate-900 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900" 
                  : "text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
              }`}
              title="System theme"
            >
              <Monitor className="h-4 w-4" />
            </button>
            </div>

            {/* Clear Chat Button */}
            {showClearButton && (
              <div className="rounded-xl border border-slate-200/50 bg-white/70 backdrop-blur-sm p-1.5 shadow-lg ring-1 ring-black/5 dark:border-slate-700/50 dark:bg-slate-800/70 dark:ring-white/10">
                <button
                  onClick={onClearChat}
                  className="rounded-lg p-2.5 transition-all duration-200 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-300"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}