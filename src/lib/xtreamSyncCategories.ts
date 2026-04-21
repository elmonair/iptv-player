import { db, type CategoryRecord } from './db'
import { makeId } from './xtreamSyncHelpers'

export async function saveCategories(
  sourceId: string,
  type: 'live' | 'movie' | 'series',
  categories: Array<{ category_id: string; category_name: string }>,
): Promise<void> {
  await db.categories
    .where('sourceId')
    .equals(sourceId)
    .and((c) => c.type === type)
    .delete()

  const records: CategoryRecord[] = categories.map((cat) => ({
    id: makeId(sourceId, `${type}-${cat.category_id}`),
    sourceId,
    type,
    externalId: cat.category_id,
    name: cat.category_name,
  }))
  if (records.length > 0) {
    await db.categories.bulkPut(records)
  }
}
