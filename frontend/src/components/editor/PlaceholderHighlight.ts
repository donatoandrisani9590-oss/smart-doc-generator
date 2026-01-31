/**
 * PlaceholderHighlight - TipTap Extension für visuelle Platzhalter-Hervorhebung
 *
 * Erkennt {{ placeholder }} Muster im Text und rendert sie als visuelle Chips.
 * Verwendet TipTap Decorations für performantes Rendering ohne DOM-Manipulation.
 *
 * UX-Verbesserung: Macht Platzhalter sofort erkennbar und unterscheidbar vom Text.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Regex für {{ placeholder }} Erkennung
// Erlaubt Leerzeichen innerhalb der Klammern: {{ name }} oder {{name}}
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

export interface PlaceholderHighlightOptions {
  /**
   * CSS-Klasse für die Platzhalter-Dekoration
   * @default 'placeholder-chip'
   */
  className: string

  /**
   * Liste bekannter Platzhalter für Validierung
   * Unbekannte Platzhalter erhalten zusätzliche Fehler-Klasse
   */
  knownPlaceholders?: string[]
}

export const PlaceholderHighlight = Extension.create<PlaceholderHighlightOptions>({
  name: 'placeholderHighlight',

  addOptions() {
    return {
      className: 'placeholder-chip',
      knownPlaceholders: [],
    }
  },

  addProseMirrorPlugins() {
    const { className, knownPlaceholders } = this.options

    return [
      new Plugin({
        key: new PluginKey('placeholderHighlight'),

        state: {
          init(_, { doc }) {
            return findPlaceholders(doc, className, knownPlaceholders || [])
          },

          apply(tr, oldDecorations) {
            // Nur bei Dokumentänderungen neu berechnen
            if (tr.docChanged) {
              return findPlaceholders(tr.doc, className, knownPlaceholders || [])
            }
            // Bestehende Dekorationen an neue Positionen anpassen
            return oldDecorations.map(tr.mapping, tr.doc)
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

/**
 * Durchsucht das Dokument nach Platzhaltern und erstellt Dekorationen
 */
function findPlaceholders(
  doc: any,
  className: string,
  knownPlaceholders: string[]
): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return

    const text = node.text || ''
    let match

    // Alle Platzhalter im Text finden
    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      const start = pos + match.index
      const end = start + match[0].length
      const placeholderName = match[1]

      // Prüfen ob Platzhalter bekannt ist
      const isKnown = knownPlaceholders.length === 0 ||
        knownPlaceholders.includes(placeholderName)

      // Spezielle Klassen für bestimmte Platzhalter-Typen
      const typeClass = placeholderName === 'paragraph_number'
        ? 'placeholder-paragraph'
        : ''

      const statusClass = !isKnown ? 'placeholder-error' : ''

      // Inline-Dekoration erstellen
      decorations.push(
        Decoration.inline(start, end, {
          class: `${className} ${typeClass} ${statusClass}`.trim(),
          'data-placeholder': placeholderName,
          'data-status': isKnown ? 'known' : 'unknown',
          'data-type': placeholderName === 'paragraph_number' ? 'paragraph_number' : 'variable',
        })
      )
    }

    // Reset regex lastIndex für nächsten Node
    PLACEHOLDER_REGEX.lastIndex = 0
  })

  return DecorationSet.create(doc, decorations)
}

export default PlaceholderHighlight
