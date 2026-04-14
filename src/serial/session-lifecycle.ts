import { open, read, close, writeSync, closeSync } from 'bun:fs'
import { spawn } from 'bun:child_process'
import { RingBuffer } from './buffer'
import { generateId } from './utils'
import type { SerialSession, SerialSessionInfo, SpawnOptions } from './types'

export class SessionLifecycleManager {
  private sessions: Map<string, SerialSession> = new Map()

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

    // Open the serial port file descriptor
    session.fd = open(session.port, 'r+')

    // Start async read loop
    this.startReadLoop(session, onData, onDisconnect)

    this.sessions.set(session.id, session)
    return session
  }

  private async configureStty(session: SerialSession): Promise<void> {
    const args = this.buildSttyArgs(session)
    await spawn(`stty`, args).exited
  }

  private buildSttyArgs(session: SerialSession): string[] {
    const { port, baudrate, databits, parity, stopbits } = session
    const args: string[] = ['-f', port, 'raw']

    // Set baud rate
    args.push(String(baudrate))

    // Set data bits
    args.push(`cs${databits}`)

    // Set parity
    if (parity === 'none') {
      args.push('-parenb')
    } else if (parity === 'even') {
      args.push('parenb', '-parodd')
    } else if (parity === 'odd') {
      args.push('parenb', 'parodd')
    } else if (parity === 'mark') {
      args.push('parenb', 'parodd', 'cmspar')
    } else if (parity === 'space') {
      args.push('parenb', '-cmspar')
    }

    // Set stop bits
    if (stopbits === 2) {
      args.push('cstopb')
    } else {
      args.push('-cstopb')
    }

    // Disable echo by default for serial
    args.push('-echo')

    return args
  }

  private async startReadLoop(
    session: SerialSession,
    onData: (session: SerialSession, data: string) => void,
    onDisconnect: (session: SerialSession) => void
  ): Promise<void> {
    const decoder = new TextDecoder()
    const fd = session.fd

    if (fd === null) return

    // Read asynchronously in a loop
    const readChunk = async (): Promise<void> => {
      while (session.status === 'open' && session.fd !== null) {
        try {
          const buffer = new Uint8Array(1024)
          const { bytesRead } = await read(fd, buffer)

          if (bytesRead > 0) {
            const text = decoder.decode(buffer.slice(0, bytesRead))
            session.buffer.append(text)
            onData(session, text)
          } else if (bytesRead === 0) {
            // EOF — device disconnected
            session.status = 'closed'
            onDisconnect(session)
            break
          }
        } catch (e) {
          if (session.status === 'open') {
            session.status = 'error'
            session.error = String(e)
            onDisconnect(session)
          }
          break
        }
      }
    }

    readChunk()
  }

  write(session: SerialSession, data: string): boolean {
    if (session.fd === null || session.status !== 'open') return false
    try {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(data)
      writeSync(session.fd, bytes)
      return true
    } catch {
      return false
    }
  }

  close(id: string, cleanup: boolean = false): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    if (session.status === 'open') {
      session.status = 'closing'
      if (session.fd !== null) {
        try {
          closeSync(session.fd)
        } catch {
          // Ignore close errors
        }
        session.fd = null
      }
      session.status = 'closed'
    }

    if (cleanup) {
      session.buffer.clear()
      this.sessions.delete(id)
    }

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
