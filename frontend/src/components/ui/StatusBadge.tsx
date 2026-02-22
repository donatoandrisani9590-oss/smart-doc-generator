import { cn } from '@/lib/utils'

/**
 * §6 — Document lifecycle status badge.
 *
 * 6 states matching the Kanban pipeline:
 * draft → review → sent → return → done → archived
 *
 * §55: Status is communicated via icon + text, never color alone.
 */

export type DocStatus = 'draft' | 'review' | 'sent' | 'return' | 'done' | 'archived'

const CONFIG: Record<DocStatus, { label: string; dot: string; bg: string; text: string }> = {
  draft:    { label: 'Entwurf',       dot: 'bg-nw-amber-500', bg: 'bg-nw-amber-50',  text: 'text-nw-amber-700' },
  review:   { label: 'Freigabe',      dot: 'bg-purple-500',   bg: 'bg-purple-50',     text: 'text-purple-700' },
  sent:     { label: 'Versendet',     dot: 'bg-nw-blue-600',  bg: 'bg-nw-blue-50',    text: 'text-nw-blue-700' },
  return:   { label: 'Rücklauf',      dot: 'bg-orange-500',   bg: 'bg-orange-50',     text: 'text-orange-700' },
  done:     { label: 'Abgeschlossen', dot: 'bg-nw-green-500', bg: 'bg-nw-green-50',   text: 'text-nw-green-700' },
  archived: { label: 'Archiviert',    dot: 'bg-nw-warm-500',  bg: 'bg-nw-warm-100',   text: 'text-nw-warm-600' },
}

export function StatusBadge({ status }: { status: DocStatus }) {
  const c = CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        c.bg, c.text,
      )}
      role="status"
      aria-label={`Status: ${c.label}`}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} aria-hidden="true" />
      {c.label}
    </span>
  )
}
