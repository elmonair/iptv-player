const BATCH_SIZE = 500

export function makeId(sourceId: string, externalId: string): string {
  return `${sourceId}:${externalId}`
}

export async function saveInBatches<T>(
  records: T[],
  table: { bulkPut: (items: T[]) => Promise<unknown> },
  onBatch: (loaded: number, total: number) => void,
): Promise<void> {
  const total = records.length
  if (total === 0) {
    onBatch(0, 0)
    return
  }
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    await table.bulkPut(batch)
    const loaded = Math.min(i + BATCH_SIZE, total)
    onBatch(loaded, total)
    // Yield back to the event loop so the UI can repaint
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

export { BATCH_SIZE }
