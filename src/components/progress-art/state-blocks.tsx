import { cn } from '@/lib/utils'

export type BlockTone = 'approved' | 'regular' | 'cursando' | 'attention' | 'pending'

export interface StateBlock {
  id: string
  /** Already agreeing with `count`: "materia cursando" / "materias cursando". */
  label: string
  count: number
  tone: BlockTone
}

export interface StateBlocksProps {
  blocks: readonly StateBlock[]
  className?: string
}

/**
 * Proportional blocks, one per state, each with its big number. Width follows
 * the share; a zero block is left out of the drawing but kept in the label.
 */
export function StateBlocks({ blocks, className }: StateBlocksProps) {
  const visible = blocks.filter((block) => block.count > 0)
  const label = blocks.map((block) => `${block.count} ${block.label}`).join(', ')
  if (visible.length === 0) {
    return <p className={cn('text-ink-muted text-sm', className)}>{label}</p>
  }
  return (
    <div role="img" aria-label={label} className={cn('art-blocks', className)}>
      {visible.map((block) => (
        <div
          key={block.id}
          className={`art-block art-tone-${block.tone}`}
          style={{ flexGrow: block.count, flexBasis: 0 }}
        >
          <span className="art-block-number">{block.count}</span>
          <span className="art-block-label">{block.label}</span>
        </div>
      ))}
    </div>
  )
}
