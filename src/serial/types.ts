import type { RingBuffer } from './buffer'

/**
 * Status of a serial port connection.
 */
export type SerialStatus = 'open' | 'closing' | 'closed' | 'error'

/**
 * Represents an active serial port session.
 * Contains all information about the serial connection and its state.
 */
export interface SerialSession {
  /** Unique session identifier */
  id: string
  /** Human-readable session title */
  title: string
  /** Optional description of the session purpose */
  description?: string
  /** Serial port path (e.g., /dev/cu.usbserial-0001) */
  port: string
  /** Baud rate (e.g., 9600, 115200) */
  baudrate: number
  /** Number of data bits (5, 6, 7, or 8) */
  databits: 5 | 6 | 7 | 8
  /** Parity setting */
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space'
  /** Number of stop bits (1 or 2) */
  stopbits: 1 | 2
  /** Flow control setting */
  flowControl: 'none' | 'hardware' | 'software'
  /** Current connection status */
  status: SerialStatus
  /** Error message if status is 'error' */
  error?: string
  /** Session creation timestamp */
  createdAt: Date
  /** Parent OpenCode session ID */
  parentSessionId: string
  /** Parent agent name */
  parentAgent?: string
  /** Whether to notify on disconnect */
  notifyOnDisconnect: boolean
  /** Ring buffer for storing serial data */
  buffer: RingBuffer
  /** File descriptor for the serial port */
  fd: number | null
  /** Read stream controller (reserved for future use) */
  readController: ReadableStreamDefaultReader<Uint8Array> | null
}

/**
 * Public information about a serial session.
 * Used for API responses and session listing.
 */
export interface SerialSessionInfo {
  /** Unique session identifier */
  id: string
  /** Human-readable session title */
  title: string
  /** Optional description */
  description?: string
  /** Serial port path */
  port: string
  /** Baud rate */
  baudrate: number
  /** Number of data bits */
  databits: number
  /** Parity setting */
  parity: string
  /** Number of stop bits */
  stopbits: number
  /** Flow control setting */
  flowControl: string
  /** Current connection status */
  status: SerialStatus
  /** Error message if applicable */
  error?: string
  /** ISO timestamp of session creation */
  createdAt: string
  /** Number of lines in the buffer */
  lineCount: number
}

/**
 * Options for opening a serial port.
 */
export interface SpawnOptions {
  /** Serial port path */
  port: string
  /** Baud rate (default: 115200) */
  baudrate?: number
  /** Data bits (default: 8) */
  databits?: 5 | 6 | 7 | 8
  /** Parity (default: none) */
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space'
  /** Stop bits (default: 1) */
  stopbits?: 1 | 2
  /** Flow control (default: none) */
  flowControl?: 'none' | 'hardware' | 'software'
  /** Human-readable title */
  title?: string
  /** Brief description */
  description?: string
  /** Parent OpenCode session ID */
  parentSessionId: string
  /** Parent agent name */
  parentAgent?: string
  /** Notify on disconnect */
  notifyOnDisconnect?: boolean
}

/**
 * Result of a serial read operation.
 */
export interface ReadResult {
  /** Array of read lines */
  lines: string[]
  /** Total number of lines in buffer */
  totalLines: number
  /** Offset from start of buffer */
  offset: number
  /** Whether more data is available */
  hasMore: boolean
}

/**
 * Result of a pattern search operation.
 */
export interface SearchResult {
  /** Matching lines with line numbers */
  matches: Array<{ lineNumber: number; text: string }>
  /** Total number of matches */
  totalMatches: number
  /** Total lines in buffer */
  totalLines: number
  /** Offset from start */
  offset: number
  /** Whether more matches exist */
  hasMore: boolean
}
