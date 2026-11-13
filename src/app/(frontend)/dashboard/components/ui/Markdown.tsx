/**
 * A small, safe Markdown renderer for AI answers: headings, bold, italics,
 * inline code, bulleted and numbered lists, paragraphs and line breaks.
 *
 * Safe by construction: it builds React elements from the text and never
 * uses dangerouslySetInnerHTML, so React escapes everything. HTML in the
 * model's text shows as plain text; links show as their words only (no
 * link is made from model output). No package needed.
 */
import { Fragment, type ReactNode } from 'react'
import { C } from './chart-theme'

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'para'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: { n: string; text: string }[] }

const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/
const BULLET = /^\s*[-*•+]\s+(.*)$/
const NUMBERED = /^\s*(\d+)([.)]|=)\s+(.*)$/

/** Split the text into blocks, line by line. Exported for tests. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const last = () => blocks[blocks.length - 1]
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (line.trim() === '') { blocks.push({ kind: 'para', lines: [] }); continue }
    let m: RegExpExecArray | null
    if ((m = HEADING.exec(line))) { blocks.push({ kind: 'heading', text: m[1] }); continue }
    if ((m = BULLET.exec(line))) {
      const b = last()
      if (b?.kind === 'ul') b.items.push(m[1]); else blocks.push({ kind: 'ul', items: [m[1]] })
      continue
    }
    if ((m = NUMBERED.exec(line))) {
      // Keep the model's own numbers ("2." twice for a tie), and "2=" as written.
      const n = m[2] === '=' ? `${m[1]}=` : m[1]
      const b = last()
      if (b?.kind === 'ol') b.items.push({ n, text: m[3] }); else blocks.push({ kind: 'ol', items: [{ n, text: m[3] }] })
      continue
    }
    const b = last()
    if (b?.kind === 'para') b.lines.push(line.trim()); else blocks.push({ kind: 'para', lines: [line.trim()] })
  }
  return blocks.filter((b) => !(b.kind === 'para' && b.lines.length === 0))
}

// Inline marks, longest first: `code`, **bold** / __bold__, *italic* / _italic_, [words](url).
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\s][^*\n]*?\*|(?<![\w])_[^_\s][^_\n]*?_(?![\w]))|(\[[^\]\n]+\]\([^)\s]+\))/g

/** Inline Markdown to React nodes; everything that isn't a mark stays text. Exported for tests. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let at = 0
  let k = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > at) out.push(text.slice(at, m.index))
    const [whole, code, bold, em, link] = m
    if (code) out.push(<code key={k++} className="rounded px-1 text-[0.95em]" style={{ background: C.chip }}>{code.slice(1, -1)}</code>)
    else if (bold) out.push(<strong key={k++} className="font-semibold" style={{ color: C.fg }}>{inline(bold.slice(2, -2))}</strong>)
    else if (em) out.push(<em key={k++}>{inline(em.slice(1, -1))}</em>)
    else if (link) out.push(<Fragment key={k++}>{inline(link.slice(1, link.indexOf('](')))}</Fragment>)
    else out.push(whole)
    at = m.index! + whole.length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

export default function Markdown({ text, className = '', id }: { text: string; className?: string; id?: string }) {
  const blocks = parseBlocks(text)
  return (
    <div id={id} className={`space-y-2 ${className}`} style={{ color: C.fg }} data-markdown>
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          return <h4 key={i} className="pt-1 text-[0.95em] font-semibold first:pt-0" style={{ color: C.accentText }}>{inline(b.text)}</h4>
        }
        if (b.kind === 'ul') {
          return <ul key={i} className="list-disc space-y-0.5 pl-5">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>
        }
        if (b.kind === 'ol') {
          return (
            <ul key={i} className="space-y-0.5">
              {b.items.map((t, j) => (
                <li key={j} className="grid grid-cols-[1.75rem_1fr] gap-1">
                  <span className="tabular-nums" style={{ color: C.muted }}>{t.n.endsWith('=') ? t.n : `${t.n}.`}</span>
                  <span>{inline(t.text)}</span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}
          </p>
        )
      })}
    </div>
  )
}
