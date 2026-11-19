import { CalendarDays } from 'lucide-react'

import { maskDateDigits, normalizePastedDate } from '@/features/items/date-input'
import { MaskedInput, type MaskedInputProps } from './masked-input'

/** dd/mm/aaaa: type digits, the "/" appear by themselves. */
export function MaskedDateInput({ placeholder = 'dd/mm/aaaa', ...props }: MaskedInputProps) {
  return (
    <MaskedInput
      leadingIcon={<CalendarDays />}
      placeholder={placeholder}
      mask={maskDateDigits}
      fromPaste={(text) => (/\d/.test(text) ? normalizePastedDate(text) : null)}
      {...props}
    />
  )
}
