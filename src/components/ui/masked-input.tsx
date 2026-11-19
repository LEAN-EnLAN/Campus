import {
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'

import { cn } from '@/lib/utils'
import { FieldLeadingIcon, fieldControlClass, fieldHeightClass } from './field'

export type MaskedInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: string
  onChange: (value: string) => void
  /** React 19 passes refs as an ordinary prop. */
  ref?: Ref<HTMLInputElement>
}

interface Props extends MaskedInputProps {
  mask: (raw: string) => string
  /** A pasted text, if it is worth replacing the whole value; else null. */
  fromPaste?: (text: string) => string | null
  leadingIcon?: ReactNode
}

const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9'
const digitsBefore = (text: string, caret: number) =>
  text.slice(0, caret).replace(/\D/g, '').length

function caretAfterDigits(text: string, digits: number): number {
  if (digits === 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (isDigit(text[i])) seen++
    if (seen === digits) return i + 1
  }
  return text.length
}

/** Shared engine of the date and time fields: format as you type, keep the caret. */
export function MaskedInput({
  mask,
  fromPaste,
  value,
  onChange,
  ref,
  leadingIcon,
  className,
  onKeyDown,
  onPaste,
  ...props
}: Props) {
  const inner = useRef<HTMLInputElement | null>(null)
  const caretDigits = useRef<number | null>(null)

  const setRef = (node: HTMLInputElement | null) => {
    inner.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  // After React writes the masked text, put the caret back after the same digit.
  useLayoutEffect(() => {
    const el = inner.current
    if (el && caretDigits.current !== null && document.activeElement === el) {
      const at = caretAfterDigits(el.value, caretDigits.current)
      el.setSelectionRange(at, at)
    }
    caretDigits.current = null
  }, [value])

  const apply = (raw: string, caret: number | null) => {
    // A caret at the end stays at the end: the mask may add a zero ("3/" -> "03")
    // that the digit count of the raw text does not know about.
    caretDigits.current =
      caret === null ? null : caret >= raw.length ? Infinity : digitsBefore(raw, caret)
    onChange(mask(raw))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.key !== 'Backspace') return
    const el = event.currentTarget
    const { selectionStart: start, selectionEnd: end } = el
    // Right after an auto-inserted "/" or ":": the mask would put it back, so
    // delete the digit before it instead of getting stuck.
    if (start === null || start !== end || start === 0 || isDigit(el.value[start - 1])) return
    event.preventDefault()
    const text = el.value
    let digitAt = start - 1
    while (digitAt >= 0 && !isDigit(text[digitAt])) digitAt--
    if (digitAt < 0) return
    apply(text.slice(0, digitAt) + text.slice(digitAt + 1), digitAt)
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event)
    if (event.defaultPrevented || !fromPaste) return
    const replacement = fromPaste(event.clipboardData.getData('text'))
    if (replacement === null) return
    event.preventDefault()
    caretDigits.current = null
    onChange(replacement)
  }

  return (
    <div className="relative">
      {leadingIcon ? <FieldLeadingIcon>{leadingIcon}</FieldLeadingIcon> : null}
      <input
        autoComplete="off"
        {...props}
        ref={setRef}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => apply(e.target.value, e.target.selectionStart)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={cn(fieldControlClass, fieldHeightClass, leadingIcon && 'pl-10', className)}
      />
    </div>
  )
}
