import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { MaskedDateInput } from '@/components/ui/masked-date-input'
import { MaskedTimeInput } from '@/components/ui/masked-time-input'
import { quickDateChips } from '@/features/items/date-chips'
import {
  maskDateDigits,
  maskTimeDigits,
  normalizePastedDate,
  parseDateInput,
  parseTimeInput,
} from '@/features/items/date-input'

function DateHarness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="d">Fecha</label>
      <MaskedDateInput id="d" value={value} onChange={setValue} />
    </>
  )
}

function TimeHarness() {
  const [value, setValue] = useState('')
  return (
    <>
      <label htmlFor="t">Hora</label>
      <MaskedTimeInput id="t" value={value} onChange={setValue} />
    </>
  )
}

describe('parseDateInput: extra forms', () => {
  it('reads a two-digit year as 20xx', () => {
    expect(parseDateInput('25/12/26')).toEqual({ year: 2026, month: 12, day: 25 })
    expect(parseDateInput('25-12-26')).toEqual({ year: 2026, month: 12, day: 25 })
    expect(parseDateInput('25.12.26')).toEqual({ year: 2026, month: 12, day: 25 })
    expect(parseDateInput('25,12,2026')).toEqual({ year: 2026, month: 12, day: 25 })
  })

  it('reads the compact digits form', () => {
    expect(parseDateInput('25122026')).toEqual({ year: 2026, month: 12, day: 25 })
    expect(parseDateInput('251226')).toEqual({ year: 2026, month: 12, day: 25 })
  })

  it('still rejects impossible or malformed dates', () => {
    expect(parseDateInput('31/02/26')).toBeNull()
    expect(parseDateInput('31022026')).toBeNull()
    expect(parseDateInput('311326')).toBeNull()
    expect(parseDateInput('29/02/2027')).toBeNull()
    expect(parseDateInput('2512202')).toBeNull()
    expect(parseDateInput('25/12/202')).toBeNull()
  })
})

describe('maskDateDigits', () => {
  it('builds dd/mm/aaaa digit by digit', () => {
    const steps = ['2', '25', '25/1', '25/12', '25/12/2', '25/12/20', '25/12/202', '25/12/2026']
    const typed = '25122026'
    steps.forEach((expected, i) => expect(maskDateDigits(typed.slice(0, i + 1))).toBe(expected))
  })

  it('stops at 8 digits', () => {
    expect(maskDateDigits('251220269999')).toBe('25/12/2026')
  })

  it('drops anything that is not a digit', () => {
    expect(maskDateDigits('ab25cd12')).toBe('25/12')
    expect(maskDateDigits('')).toBe('')
  })

  it('tolerates typed separators, padding a lone digit', () => {
    expect(maskDateDigits('25/12/2026')).toBe('25/12/2026')
    expect(maskDateDigits('3/4/2026')).toBe('03/04/2026')
    expect(maskDateDigits('3/')).toBe('03')
    expect(maskDateDigits('25-12-26')).toBe('25/12/26')
  })

  it('never ends with a separator', () => {
    expect(maskDateDigits('25')).toBe('25')
    expect(maskDateDigits('25/')).toBe('25')
  })
})

describe('maskTimeDigits', () => {
  it('puts the colon after the hour', () => {
    expect(maskTimeDigits('0930')).toBe('09:30')
    expect(maskTimeDigits('2359')).toBe('23:59')
    expect(maskTimeDigits('09')).toBe('09')
    expect(maskTimeDigits('093')).toBe('09:3')
  })

  it('treats an hour starting with 3-9 as one digit', () => {
    expect(maskTimeDigits('930')).toBe('9:30')
    expect(maskTimeDigits('93')).toBe('9:3')
    expect(maskTimeDigits('9')).toBe('9')
    expect(maskTimeDigits('9300')).toBe('9:30')
  })

  it('caps at 4 digits and tolerates a typed colon', () => {
    expect(maskTimeDigits('123456')).toBe('12:34')
    expect(maskTimeDigits('9:30')).toBe('9:30')
    expect(maskTimeDigits('1:30')).toBe('01:30')
    expect(maskTimeDigits('18:30')).toBe('18:30')
    expect(maskTimeDigits('')).toBe('')
  })

  it('shows impossible times and lets the parser reject them', () => {
    expect(maskTimeDigits('2460')).toBe('24:60')
    expect(parseTimeInput('24:60')).toBeNull()
    expect(parseTimeInput('23:59')).toEqual({ hours: 23, minutes: 59 })
    expect(parseTimeInput(maskTimeDigits('0930'))).toEqual({ hours: 9, minutes: 30 })
    expect(parseTimeInput(maskTimeDigits('930'))).toEqual({ hours: 9, minutes: 30 })
  })
})

describe('normalizePastedDate', () => {
  it.each(['25/12/2026', '25122026', '25-12-26', '25.12.26', ' 25/12/26 ', '251226'])(
    'turns %j into 25/12/2026',
    (text) => {
      expect(normalizePastedDate(text)).toBe('25/12/2026')
    },
  )

  it('pads one-digit parts', () => {
    expect(normalizePastedDate('3/4/2026')).toBe('03/04/2026')
  })

  it('falls back to the mask for anything else', () => {
    expect(normalizePastedDate('2512')).toBe('25/12')
  })
})

describe('MaskedDateInput', () => {
  it('has the numeric keyboard and the placeholder', () => {
    render(<DateHarness />)
    const input = screen.getByLabelText('Fecha')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('placeholder', 'dd/mm/aaaa')
  })

  it('inserts the slashes while typing', async () => {
    const user = userEvent.setup()
    render(<DateHarness />)
    const input = screen.getByLabelText('Fecha')
    await user.type(input, '2512')
    expect(input).toHaveValue('25/12')
    await user.type(input, '2026')
    expect(input).toHaveValue('25/12/2026')
  })

  it('ignores digits past the 8th', async () => {
    const user = userEvent.setup()
    render(<DateHarness />)
    const input = screen.getByLabelText('Fecha')
    await user.type(input, '251220269999')
    expect(input).toHaveValue('25/12/2026')
  })

  it('accepts typed slashes without doubling them', async () => {
    const user = userEvent.setup()
    render(<DateHarness />)
    const input = screen.getByLabelText('Fecha')
    await user.type(input, '25/12/2026')
    expect(input).toHaveValue('25/12/2026')
  })

  it('pads a day typed with its slash', async () => {
    const user = userEvent.setup()
    render(<DateHarness />)
    const input = screen.getByLabelText('Fecha')
    await user.type(input, '3/4/2026')
    expect(input).toHaveValue('03/04/2026')
  })

  it('backspace right after an auto-inserted slash removes the digit before it', async () => {
    const user = userEvent.setup()
    render(<DateHarness initial="25/12/2026" />)
    const input = screen.getByLabelText<HTMLInputElement>('Fecha')
    // Caret right after the first "/": the 5 goes, the day is re-padded.
    input.focus()
    input.setSelectionRange(3, 3)
    await user.keyboard('{Backspace}')
    expect(input).toHaveValue('02/12/2026')
  })

  it('backspace walks back through the whole value without sticking', async () => {
    const user = userEvent.setup()
    render(<DateHarness />)
    const input = screen.getByLabelText('Fecha')
    await user.type(input, '251220')
    expect(input).toHaveValue('25/12/20')
    const seen: string[] = []
    for (let i = 0; i < 6; i++) {
      await user.keyboard('{Backspace}')
      seen.push((input as HTMLInputElement).value)
    }
    expect(seen).toEqual(['25/12/2', '25/12', '25/1', '25', '2', ''])
  })

  it('keeps the caret after the edited digit', async () => {
    const user = userEvent.setup()
    render(<DateHarness initial="25/12" />)
    const input = screen.getByLabelText<HTMLInputElement>('Fecha')
    input.focus()
    input.setSelectionRange(2, 2)
    await user.keyboard('7')
    expect(input).toHaveValue('25/71/2')
    expect(input.selectionStart).toBe(4)
  })

  it.each([
    ['25/12/2026', '25/12/2026'],
    ['25122026', '25/12/2026'],
    ['25-12-26', '25/12/2026'],
    ['25.12.26', '25/12/2026'],
  ])('normalises a paste of %j', async (pasted, expected) => {
    const user = userEvent.setup()
    render(<DateHarness />)
    const input = screen.getByLabelText('Fecha')
    await user.click(input)
    await user.paste(pasted)
    expect(input).toHaveValue(expected)
  })

  it('forwards id, aria props, name and ref', () => {
    let node: HTMLInputElement | null = null
    render(
      <MaskedDateInput
        id="x"
        name="due"
        aria-describedby="why"
        aria-invalid
        disabled
        value=""
        onChange={() => {}}
        ref={(n) => {
          node = n
        }}
      />,
    )
    const input = document.getElementById('x')
    expect(input).toBe(node)
    expect(input).toHaveAttribute('name', 'due')
    expect(input).toHaveAttribute('aria-describedby', 'why')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toBeDisabled()
  })
})

describe('MaskedTimeInput', () => {
  it('has the numeric keyboard and the placeholder', () => {
    render(<TimeHarness />)
    const input = screen.getByLabelText('Hora')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('placeholder', 'hh:mm')
  })

  it.each([
    ['0930', '09:30'],
    ['930', '9:30'],
    ['2359', '23:59'],
    ['2460', '24:60'],
    ['18:30', '18:30'],
  ])('typing %j shows %j', async (typed, expected) => {
    const user = userEvent.setup()
    render(<TimeHarness />)
    const input = screen.getByLabelText('Hora')
    await user.type(input, typed)
    expect(input).toHaveValue(expected)
  })

  it('backspace across the colon removes the minute, then the hour', async () => {
    const user = userEvent.setup()
    render(<TimeHarness />)
    const input = screen.getByLabelText('Hora')
    await user.type(input, '0930')
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      await user.keyboard('{Backspace}')
      seen.push((input as HTMLInputElement).value)
    }
    expect(seen).toEqual(['09:3', '09', '0', ''])
  })

  it('backspace right after the colon removes the hour digit before it', async () => {
    const user = userEvent.setup()
    render(<TimeHarness />)
    const input = screen.getByLabelText<HTMLInputElement>('Hora')
    await user.type(input, '1230')
    input.setSelectionRange(3, 3)
    await user.keyboard('{Backspace}')
    expect(input).toHaveValue('01:30')
  })
})

describe('quickDateChips', () => {
  // Thursday 19 November 2026.
  const thursday = new Date(2026, 10, 19, 15, 0)

  it('gives hoy, mañana, viernes and +1 semana as dd/mm/aaaa', () => {
    expect(quickDateChips(thursday)).toEqual([
      { label: 'Hoy', date: '19/11/2026' },
      { label: 'Mañana', date: '20/11/2026' },
      { label: 'Viernes', date: '20/11/2026' },
      { label: '+1 semana', date: '26/11/2026' },
    ])
  })

  it('takes the next Friday strictly after today', () => {
    const saturday = new Date(2026, 10, 21)
    expect(quickDateChips(saturday)[2]?.date).toBe('27/11/2026')
    const monday = new Date(2026, 10, 16)
    expect(quickDateChips(monday)[2]?.date).toBe('20/11/2026')
  })

  it('on a Friday, Viernes is today', () => {
    const friday = new Date(2026, 10, 20, 23, 30)
    expect(quickDateChips(friday)[2]?.date).toBe('20/11/2026')
  })

  it('crosses months and years', () => {
    const chips = quickDateChips(new Date(2026, 11, 30))
    expect(chips[1]?.date).toBe('31/12/2026')
    expect(chips[3]?.date).toBe('06/01/2027')
  })

  it('every chip parses back as a real date', () => {
    for (const chip of quickDateChips(thursday))
      expect(parseDateInput(chip.date)).not.toBeNull()
  })
})
