import { useState } from "react"
import { Copy, Check, ThumbsUp, ThumbsDown, MoreHorizontal, Share, Bookmark } from "lucide-react"

interface MessageActionsProps {
  text: string
  messageId: string
  isUser: boolean
}

export default function MessageActions({ text, messageId, isUser }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [liked, setLiked] = useState<boolean | null>(null)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const handleLike = (isLike: boolean) => {
    setLiked(isLike)
    console.log(`Message ${messageId} ${isLike ? "liked" : "disliked"}`)
  }

  const handleShare = () => {
    console.log("Share message:", messageId)
  }

  const handleBookmark = () => {
    console.log("Bookmark message:", messageId)
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Copy Button */}
      <button
        onClick={copyToClipboard}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Copy message"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        )}
      </button>

      {/* Like/Dislike for AI messages */}
      {!isUser && (
        <>
          <button
            onClick={() => handleLike(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              liked === true
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
            }`}
            title="Like response"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleLike(false)}
            className={`p-1.5 rounded-lg transition-colors ${
              liked === false
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
            }`}
            title="Dislike response"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* More Actions */}
      <div className="relative">
        <button
          onClick={() => setShowActions(!showActions)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="More actions"
        >
          <MoreHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        </button>

        {showActions && (
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[120px] z-10">
            <button
              onClick={handleShare}
              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Share className="w-3.5 h-3.5" />
              Share
            </button>
            <button
              onClick={handleBookmark}
              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Bookmark
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
