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
 *
 * It also owns the RULING. That used to be painted by the shell, on a box the
 * text scrolled inside — so the lines and the paper agreed only at scroll
 * position zero. The ruling belongs to the scroller, with
 * `background-attachment: local`, which ties the gradient's origin to the
 * scrolled content instead of the border box: the paper now moves with the
 * words, and still fills the pane when the note is three lines long.
 */

/**
 * The ruling itself: one vertical margin line, then a horizontal rule at the
 * bottom of every --rule-height band. Every offset comes from the tokens in
 * globals.css, so the grid cannot drift away from the line box that sits on it.
 */
const RULED_PAPER = [
  `linear-gradient(90deg,
     transparent 0,
     transparent var(--rule-margin),
     var(--color-rule-soft) var(--rule-margin),
     var(--color-rule-soft) calc(var(--rule-margin) + 1px),
     transparent calc(var(--rule-margin) + 1px))`,
  `repeating-linear-gradient(180deg,
     transparent 0,
     transparent calc(var(--rule-height) - 1px),
     var(--color-rule-soft) calc(var(--rule-height) - 1px),
     var(--color-rule-soft) var(--rule-height))`,
].join(',')

export const campusEditorTheme = EditorView.theme({
  '&': {
    fontSize: '0.9375rem',
    color: 'var(--color-ink)',
    backgroundColor: 'transparent',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'var(--font-editor, ui-serif, Georgia, serif)',
    // A LENGTH, not a ratio — see the note on --rule-height. This is the one
    // declaration that puts text on the lines instead of near them.
    lineHeight: 'var(--rule-height)',
    // Whole bands, top and bottom: a half-band of padding offsets every single
    // line in the document by that half band.
    paddingTop: 'var(--rule-height)',
    paddingBottom: 'calc(var(--rule-height) * 4)',
    // Text starts past the margin line, never on top of it.
    paddingLeft: 'var(--rule-text-inset)',
    // The readable-measure rule: prose lines longer than ~72ch are measurably
    // harder to track. Bounded from the RIGHT rather than by centring a narrow
    // box, because the paper — and therefore the ruling — must stay full bleed.
    paddingRight: 'max(var(--rule-gutter), calc(100% - var(--rule-text-inset) - 72ch))',
    caretColor: 'var(--color-accent)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    padding: '0',
    backgroundImage: RULED_PAPER,
    backgroundAttachment: 'local',
  },
  // No horizontal padding: the first character must land exactly on the text
  // inset, and 2px of line padding is 2px of misalignment.
  '.cm-line': { padding: '0' },
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
    // NOTHING changes the line box — not even a heading. Two reasons.
    //
    // A two-rule heading is on the grid arithmetically and wrong to the eye: a
    // 56px line box centres its text, so the baseline lands halfway between
    // the two rules and the title floats. CSS gives no way to bias inline
    // leading downward onto the lower rule.
    //
    // And a one-rule heading is not automatic either. An inline box with a
    // BIGGER font has its baseline lower inside the same 28px of leading, so
    // the line box becomes the union of two differently-seated boxes — 29px,
    // and the drift compounds one pixel per heading. `line-height: 0` is the
    // fix: the span contributes no leading at all, the strut alone sets the
    // line box to exactly one rule, and the glyphs still paint full size.
    //
    // Which is why every rule below that changes font-size or font-family —
    // heading, inline code, fence — must zero its leading too.
    { tag: tags.heading1, fontSize: '1.3em', fontWeight: '700', lineHeight: '0' },
    { tag: tags.heading2, fontSize: '1.15em', fontWeight: '650', lineHeight: '0' },
    { tag: tags.heading3, fontSize: '1.05em', fontWeight: '600', lineHeight: '0' },
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
    {
      tag: tags.monospace,
      fontFamily: 'var(--font-mono, ui-monospace, monospace)',
      lineHeight: '0',
    },
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
