import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/**
 * The CodeMirror theme, expressed in the app's own CSS variables.
 *
 * Hardcoding colors here would fork the design system: dark mode, and any
 * future token change, would have to be re-implemented inside the editor. By
 * pointing at `var(--...)` the editor follows the theme for free — including
 * the reduced-contrast `ink-muted` for syntax that should recede.
 *
 * The editor body is the most-read text in the whole app, so it gets the
 * reading font size and a generous line height rather than "code editor"
 * defaults.
 */
export const campusEditorTheme = EditorView.theme({
  '&': {
    fontSize: '0.9375rem',
    color: 'var(--color-ink)',
    backgroundColor: 'transparent',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'var(--font-editor, ui-serif, Georgia, serif)',
    lineHeight: '1.7',
    padding: '1rem 0',
    caretColor: 'var(--color-accent)',
    // The readable-measure rule: prose lines longer than ~72ch are measurably
    // harder to track. The editor centres a bounded column instead of running
    // wall to wall on wide panes.
    maxWidth: '72ch',
    margin: '0 auto',
  },
  '.cm-scroller': { overflow: 'auto', padding: '0 1.25rem' },
  '.cm-line': { padding: '0 2px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--color-accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--color-selection, rgba(120,120,255,0.18)) !important',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-panels': {
    backgroundColor: 'var(--color-paper-elevated)',
    color: 'var(--color-ink)',
    borderTop: '1px solid var(--color-rule)',
  },
  '.cm-searchMatch': { backgroundColor: 'var(--color-selection, rgba(255,220,0,0.3))' },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-paper-elevated)',
    border: '1px solid var(--color-rule)',
    color: 'var(--color-ink)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--color-selection, rgba(120,120,255,0.18))',
    color: 'var(--color-ink)',
  },
})

/**
 * Markdown syntax colouring. Deliberately quiet: this is a NOTE, not source
 * code. Structure (headings, list marks) gets weight; decoration (marks,
 * urls) recedes into ink-muted; only links and code carry accent.
 */
export const campusHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, fontSize: '1.5em', fontWeight: '650' },
    { tag: tags.heading2, fontSize: '1.25em', fontWeight: '650' },
    { tag: tags.heading3, fontSize: '1.1em', fontWeight: '600' },
    { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600' },
    { tag: tags.strong, fontWeight: '650' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    {
      tag: tags.strikethrough,
      textDecoration: 'line-through',
      color: 'var(--color-ink-muted)',
    },
    { tag: tags.link, color: 'var(--color-accent)' },
    { tag: tags.url, color: 'var(--color-ink-muted)' },
    { tag: tags.quote, color: 'var(--color-ink-muted)', fontStyle: 'italic' },
    { tag: tags.monospace, fontFamily: 'var(--font-mono, ui-monospace, monospace)' },
    {
      tag: tags.processingInstruction,
      color: 'var(--color-ink-faint, var(--color-ink-muted))',
    },
    { tag: tags.meta, color: 'var(--color-ink-muted)' },
    // Code-block languages students actually use — lezer resolves these via
    // @codemirror/language-data lazily, these tags style the fence body.
    { tag: tags.keyword, color: 'var(--color-accent-ink, var(--color-accent))' },
    { tag: tags.string, color: 'var(--color-success, #2f7d4f)' },
    { tag: tags.comment, color: 'var(--color-ink-muted)', fontStyle: 'italic' },
    { tag: [tags.number, tags.bool], color: 'var(--color-warning, #a06500)' },
  ]),
)
