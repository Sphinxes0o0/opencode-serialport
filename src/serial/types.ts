import type { RingBuffer } from './buffer'

export type SerialStatus = 'open' | 'closing' | 'closed' | 'error'

export interface SerialSession {
  id: string
  title: string
  description?: string
  port: string
  baudrate: number
  databits: 5 | 6 | 7 | 8
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space'
  stopbits: 1 | 1.5 | 2
  flowControl: 'none' | 'hardware' | 'software'
  status: SerialStatus
  error?: string
  createdAt: Date
  parentSessionId: string
  parentAgent?: string
  notifyOnDisconnect: boolean
  buffer: RingBuffer
  fd: number | null
  readController: ReadableStreamDefaultReader<Uint8Array> | null
}

export interface SerialSessionInfo {
  id: string
  title: string
  description?: string
  port: string
  baudrate: number
  databits: number
  parity: string
  stopbits: number
  flowControl: string
  status: SerialStatus
  error?: string
  createdAt: string
  lineCount: number
}

export interface SpawnOptions {
  port: string
  baudrate?: number
  databits?: 5 | 6 | 7 | 8
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space'
  stopbits?: 1 | 1.5 | 2
  flowControl?: 'none' | 'hardware' | 'software'
  title?: string
  description?: string
  parentSessionId: string
  parentAgent?: string
  notifyOnDisconnect?: boolean
}

export interface ReadResult {
  lines: string[]
  totalLines: number
  offset: number
  hasMore: boolean
}

export interface SearchResult {
  matches: Array<{ lineNumber: number; text: string }>
  totalMatches: number
  totalLines: number
  offset: number
  hasMore: boolean
}
