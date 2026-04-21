import Dexie from 'dexie'
import type { Table } from 'dexie'

export type PlaylistSourceRecord = {
  id: string
  type: 'm3u-url' | 'xtream'
  name: string
  createdAt: number
  url?: string
  serverUrlEncrypted?: string
  usernameEncrypted?: string
  passwordEncrypted?: string
}

class IptvDatabase extends Dexie {
  sources!: Table<PlaylistSourceRecord>

  constructor() {
    super('IptvDatabase')
    this.version(1).stores({
      sources: 'id, type, createdAt',
    })
  }
}

export const db = new IptvDatabase()
