import { cn } from '@/lib/utils'

/**
 * Ajustes → Asistente's spot: a chat bubble "thinking" and the student's own
 * key in front of it. Hand-drawn in the language of the raster settings set
 * (the settings-*.webp spots of the Illustration registry): navy outline, blue
 * monochrome fills, one soft lower-right shade per shape, a dotted ring behind. Same 16:10
 * frame and the same empty margin, so it sits beside its siblings at the same
 * size. Decorative: the card's title already says what it is.
 */
export function AssistantIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 80"
      aria-hidden="true"
      focusable="false"
      className={cn('art-spot h-auto', className)}
    >
      <circle className="art-ring" cx="64" cy="40" r="30" />
      <g transform="translate(64 40) scale(0.86) translate(-64 -38)">
        {/* Chat bubble */}
        <path
          className="art-fill-paper"
          d="M42 15h40a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H54l-9 7v-7h-3a8 8 0 0 1-8-8V23a8 8 0 0 1 8-8z"
        />
        <path className="art-shade" d="M90 25v18a8 8 0 0 1-8 8H54l2-3h24a6 6 0 0 0 6-6V24z" />
        <path
          className="art-outline"
          d="M42 15h40a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H54l-9 7v-7h-3a8 8 0 0 1-8-8V23a8 8 0 0 1 8-8z"
        />
        <circle className="art-fill-blue" cx="50" cy="33" r="3.6" />
        <circle className="art-fill-mid" cx="62" cy="33" r="3.6" />
        <circle className="art-fill-soft" cx="74" cy="33" r="3.6" />

        {/* Sparkle */}
        <path
          className="art-fill-blue art-outline-fill"
          d="M95 9l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"
        />

        {/* Key, in front */}
        <g transform="rotate(-18 84 58)">
          <path className="art-fill-mid" d="M88 54h20a2 2 0 0 1 2 2v2l-3 3-3-3-3 3-3-3h-10z" />
          <path className="art-shade" d="M88 58h13l-3 3-3-3h-7z" />
          <path className="art-outline" d="M88 54h20a2 2 0 0 1 2 2v2l-3 3-3-3-3 3-3-3h-10" />
          <circle className="art-fill-blue" cx="80" cy="56.5" r="10" />
          <path className="art-shade" d="M89 59a10 10 0 0 1-15 5.5a10 10 0 0 0 12-9z" />
          <circle className="art-outline" cx="80" cy="56.5" r="10" />
          <circle className="art-fill-paper art-outline-fill" cx="77" cy="56.5" r="3.2" />
        </g>
      </g>
    </svg>
  )
}
