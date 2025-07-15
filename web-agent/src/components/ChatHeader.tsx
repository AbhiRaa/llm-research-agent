import { useState } from "react"
import { Sparkles, Settings, Trash2, Download, Upload } from "lucide-react"

interface ChatHeaderProps {
  onClearChat: () => void
  onExportChat: () => void
  onImportChat: () => void
}

export default function ChatHeader({ onClearChat, onExportChat, onImportChat }: ChatHeaderProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI Assistant</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ask me anything</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Indicator */}
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Online</span>
          </div>

          {/* Settings Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[160px] z-10">
                <button
                  onClick={() => {
                    onExportChat()
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Chat
                </button>
                <button
                  onClick={() => {
                    onImportChat()
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Import Chat
                </button>
                <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                <button
                  onClick={() => {
                    onClearChat()
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
