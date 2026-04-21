import { openSync, readSync, closeSync, writeSync } from 'node:fs'
import { $ } from 'bun'
import { RingBuffer } from './buffer'
import { generateId } from './utils'
import type { SerialSession, SerialSessionInfo, SpawnOptions } from './types'

export class SessionLifecycleManager {
  private sessions: Map<string, SerialSession> = new Map()
  private writeQueues: Map<string, Promise<void>> = new Map()

  async open(
    opts: SpawnOptions,
    onData: (session: SerialSession, data: string) => void,
    onDisconnect: (session: SerialSession) => void
  ): Promise<SerialSession> {
    const id = generateId()
    const title =
      opts.title ?? `Serial ${opts.port} @ ${opts.baudrate ?? 115200} baud`

    const session: SerialSession = {
      id,
      title,
      description: opts.description,
      port: opts.port,
      baudrate: opts.baudrate ?? 115200,
      databits: opts.databits ?? 8,
      parity: opts.parity ?? 'none',
      stopbits: opts.stopbits ?? 1,
      flowControl: opts.flowControl ?? 'none',
      status: 'open',
      createdAt: new Date(),
      parentSessionId: opts.parentSessionId,
      parentAgent: opts.parentAgent,
      notifyOnDisconnect: opts.notifyOnDisconnect ?? false,
      buffer: new RingBuffer(),
      fd: null,
      readController: null,
    }

    // Configure stty for the serial port
    await this.configureStty(session)

    // Open the serial port file descriptor (synchronous)
    session.fd = openSync(session.port, 'r+')

    // Start async read loop (fire-and-forget)
    this.startReadLoop(session, onData, onDisconnect)

    // Only store session after fd is open and read loop started
    this.sessions.set(session.id, session)
    return session
  }

  private async configureStty(session: SerialSession): Promise<void> {
    const sttyCmd = this.buildSttyCommand(session)
    await $`${sttyCmd}`
  }

  private buildSttyCommand(session: SerialSession): string {
    const { port, baudrate, databits, parity, stopbits, flowControl } = session

    // Sanitize port path to prevent command injection
    if (!/^[\w\/\.-]+$/.test(port)) {
      throw new Error(`Invalid port path: contains potentially dangerous characters: ${port}`)
    }

    const parts: string[] = ['stty', '-f', port]

    // Set baud rate
    parts.push(String(baudrate))

    // Set data bits
    parts.push(`cs${databits}`)

    // Set parity
    if (parity === 'none') {
      parts.push('-parenb')
    } else if (parity === 'even') {
      parts.push('parenb', '-parodd')
    } else if (parity === 'odd') {
      parts.push('parenb', 'parodd')
    } else if (parity === 'mark') {
      parts.push('parenb', 'parodd', 'cmspar')
    } else if (parity === 'space') {
      parts.push('parenb', '-cmspar')
    }

    // Set stop bits
    if (stopbits === 2) {
      parts.push('cstopb')
    } else {
      parts.push('-cstopb')
    }

    // Set flow control
    if (flowControl === 'hardware') {
      parts.push('crtscts')
    } else if (flowControl === 'software') {
      parts.push('ixon', 'ixany')
    } else {
      parts.push('-crtscts', '-ixon', '-ixany')
    }

    // Disable echo by default for serial
    parts.push('-echo')

    // raw mode last to ensure settings are applied
    parts.push('raw')

    return parts.join(' ')
  }

  private async startReadLoop(
    session: SerialSession,
    onData: (session: SerialSession, data: string) => void,
    onDisconnect: (session: SerialSession) => void
  ): Promise<void> {
    const decoder = new TextDecoder()
    const fd = session.fd

    if (fd === null) return

    // Read asynchronously in a loop using setTimeout to avoid blocking
    const readChunk = (): void => {
      if (session.status !== 'open' || session.fd === null) {
        return
      }

      try {
        const buffer = new Uint8Array(1024)
        const bytesRead = readSync(fd, buffer)

        if (bytesRead > 0) {
          const text = decoder.decode(buffer.slice(0, bytesRead))
          session.buffer.append(text)
          onData(session, text)
          // Schedule next read
          setTimeout(() => readChunk(), 0)
        } else if (bytesRead === 0) {
          // EOF — device disconnected
          session.status = 'closed'
          onDisconnect(session)
        }
      } catch (e) {
        if (session.status === 'open') {
          session.status = 'error'
          session.error = String(e)
          onDisconnect(session)
        }
      }
    }

    readChunk()
  }

  write(session: SerialSession, data: string): boolean {
    if (session.fd === null || session.status !== 'open') return false
    // Serialize writes to prevent data interleaving
    const lastWrite = this.writeQueues.get(session.id) ?? Promise.resolve()
    const thisWrite = lastWrite.then(() => {
      if (session.fd === null || session.status !== 'open') return
      try {
        const encoder = new TextEncoder()
        const bytes = encoder.encode(data)
        writeSync(session.fd, bytes)
      } catch {
        // Write error — will be reported on next read
      }
    })
    this.writeQueues.set(session.id, thisWrite)
    return true
  }

  close(id: string, cleanup: boolean = false): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    if (session.status === 'open' || session.status === 'closing') {
      session.status = 'closing'
      if (session.fd !== null) {
        // Set fd=null BEFORE closeSync to prevent race with read loop
        const fd = session.fd
        session.fd = null
        try {
          closeSync(fd)
        } catch {
          // Ignore close errors
        }
      }
      session.status = 'closed'
    }

    if (cleanup) {
      session.buffer.clear()
      this.sessions.delete(id)
    }

    // Always clean up write queue when closing
    this.writeQueues.delete(id)

    return true
  }

  clearAllSessions(): void {
    for (const id of [...this.sessions.keys()]) {
      this.close(id, true)
    }
  }

  cleanupBySession(parentSessionId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.parentSessionId === parentSessionId) {
        this.close(id, true)
      }
    }
  }

  getSession(id: string): SerialSession | null {
    return this.sessions.get(id) || null
  }

  listSessions(): SerialSession[] {
    return Array.from(this.sessions.values())
  }

  toInfo(session: SerialSession): SerialSessionInfo {
    return {
      id: session.id,
      title: session.title,
      description: session.description,
      port: session.port,
      baudrate: session.baudrate,
      databits: session.databits,
      parity: session.parity,
      stopbits: session.stopbits,
      flowControl: session.flowControl,
      status: session.status,
      error: session.error,
      createdAt: session.createdAt.toISOString(),
      lineCount: session.buffer.length,
    }
  }
}
