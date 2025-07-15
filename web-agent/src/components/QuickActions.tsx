import { Lightbulb, Code, FileText, Calculator, Search, Zap } from "lucide-react"

interface QuickActionsProps {
  onQuickAction: (action: string) => void
}

const quickActions = [
  {
    icon: Lightbulb,
    label: "Explain this",
    action: "explain",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: Code,
    label: "Write code",
    action: "code",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: FileText,
    label: "Summarize",
    action: "summarize",
    color: "from-green-500 to-teal-500",
  },
  {
    icon: Calculator,
    label: "Calculate",
    action: "calculate",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Search,
    label: "Research",
    action: "research",
    color: "from-indigo-500 to-purple-500",
  },
  {
    icon: Zap,
    label: "Quick task",
    action: "quick",
    color: "from-orange-500 to-red-500",
  },
]

export default function QuickActions({ onQuickAction }: QuickActionsProps) {
  return (
    <div className="px-4 pb-3">
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action.action}
            onClick={() => onQuickAction(action.action)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r ${action.color} rounded-full hover:shadow-lg transition-all duration-200 transform hover:scale-105`}
          >
            <action.icon className="w-3 h-3" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
