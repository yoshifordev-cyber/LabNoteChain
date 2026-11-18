import { useMemo } from 'react'
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true
})

type Props = {
  source: string
  className?: string
}

/** 本文はローカル執筆の Markdown。表示時のみ HTML 化する。 */
export default function MarkdownBody({ source, className }: Props) {
  const html = useMemo(() => {
    const raw = source?.trim() ? source : ''
    if (!raw) return ''
    return marked.parse(raw, { async: false }) as string
  }, [source])

  if (!html) {
    return <div className={`md-body md-empty ${className ?? ''}`.trim()} />
  }

  return (
    <div
      className={`md-body ${className ?? ''}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
