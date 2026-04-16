import { writeSync } from 'node:fs'
import type { SerialSession, ReadResult, SearchResult } from './types'

export class OutputManager {
  write(session: SerialSession, data: string): boolean {
    if (session.fd === null) return false
    try {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(data)
      writeSync(session.fd, bytes)
      return true
    } catch {
      return false
    }
  }

  read(session: SerialSession, offset: number = 0, limit?: number): ReadResult {
    const lines = session.buffer.read(offset, limit)
    const totalLines = session.buffer.length
    const hasMore = offset + lines.length < totalLines
    return { lines, totalLines, offset, hasMore }
  }

  search(
    session: SerialSession,
    pattern: RegExp,
    offset: number = 0,
    limit?: number
  ): SearchResult {
    const allMatches = session.buffer.search(pattern)
    const totalMatches = allMatches.length
    const totalLines = session.buffer.length
    const paginatedMatches =
      limit !== undefined ? allMatches.slice(offset, offset + limit) : allMatches.slice(offset)
    const hasMore = offset + paginatedMatches.length < totalMatches
    return { matches: paginatedMatches, totalMatches, totalLines, offset, hasMore }
  }

  clear(session: SerialSession): void {
    session.buffer.clear()
  }
}
