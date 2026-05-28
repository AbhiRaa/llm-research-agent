import { useEffect, useState } from "react"
import type { Citation } from "../hooks/useStream"
import Message from "./Message"
import { ArrowRight } from "lucide-react"

interface SharedPayload {
  question: string
  answer: string
  citations: Citation[]
  created_at: number
}

export default function SharedView({ id }: { id: string }) {
  const [data, setData] = useState<SharedPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL || ""
    fetch(`${base}/api/share/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError("That proof has expired or never existed."))
  }, [id])

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="grain no-print" aria-hidden="true" />
      <header className="sticky top-0 z-40 backdrop-blur-[2px]">
        <div className="mx-auto w-full max-w-[1100px] px-5 pt-4 sm:px-8">
          <div className="flex items-end justify-between gap-4 pb-2">
            <h1
              className="riso-title text-3xl sm:text-4xl"
              data-text="PROOF"
              style={{ fontWeight: 800, letterSpacing: "-0.03em" }}
            >
              PROOF
            </h1>
            <a
              href="/"
              className="press-btn ring-riso mono inline-flex h-9 items-center gap-2 px-3 text-[0.7rem] uppercase tracking-widest"
              style={{ background: "var(--flame)", color: "var(--paper)" }}
            >
              Ask your own <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </a>
          </div>
          <hr className="rule-double" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
        {error && (
          <p
            className="text-center"
            style={{ fontFamily: "var(--font-body)", color: "var(--ink-mute)" }}
          >
            {error}
          </p>
        )}
        {data && (
          <>
            <p
              className="kicker"
              style={{ color: "var(--blue)" }}
            >
              A shared proof
            </p>
            <Message role="user" text={data.question} seq={1} />
            <Message
              role="assistant"
              text={data.answer}
              citations={data.citations}
              seq={1}
            />
          </>
        )}
      </main>
    </div>
  )
}
