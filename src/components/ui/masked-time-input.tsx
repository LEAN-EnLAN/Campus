import { Clock } from 'lucide-react'

import { maskTimeDigits } from '@/features/items/date-input'
import { MaskedInput, type MaskedInputProps } from './masked-input'

/** hh:mm: type digits, the ":" appears by itself. */
export function MaskedTimeInput({ placeholder = 'hh:mm', ...props }: MaskedInputProps) {
  return (
    <MaskedInput
      leadingIcon={<Clock />}
      placeholder={placeholder}
      mask={maskTimeDigits}
      {...props}
    />
  )
}
