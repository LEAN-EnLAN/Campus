export const CONTAINER: string
export const SOURCE_DB: string

export function makeTempName(bytes?: Uint8Array): string
export function assertTempName(name: string): string
export function schemaQuery(): string
export function rowQuery(
  relations: Array<{ schema: string; name: string; kind: string }>,
): string
export function compareSnapshots(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): { pass: boolean; checks: Record<string, boolean> }
export function firstColumnDifference(
  source: { columns: Array<Record<string, unknown>> },
  target: { columns: Array<Record<string, unknown>> },
): { schema: unknown; table: unknown; column: unknown; fields: string[] } | null
export function rehearse(): Promise<Record<string, unknown>>
