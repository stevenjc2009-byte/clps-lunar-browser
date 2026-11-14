import { useState, type ReactNode } from 'react'

// "Explain it to me": a small "?" button that opens a plain-language note.
// `all` (the header switch) opens every note on the page at once.
export default function Explain({ term, all, children }: { term: string; all: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const shown = open || all
  return (
    <>
      <button type="button" className="explain-btn" aria-expanded={shown}
        aria-label={`Explain: ${term}`} title={`Explain: ${term}`}
        onClick={() => setOpen(o => !o)}>?</button>
      {shown && <span className="explain-note" role="note">{children}</span>}
    </>
  )
}
