import type { Server, ServerWebSocket } from 'bun'
import { join } from 'path'
import { manager } from '../../serial/manager'

interface WebSocketData {
  sessionId: string
}

// Resolve dist/web directory relative to process.cwd()
function getDistWebPath(): string {
  return join(process.cwd(), 'dist', 'web')
}

/**
 * WebSocket message batching configuration
 */
const BATCH_CONFIG = {
  /** Maximum messages to batch before flushing */
  maxBatchSize: 10,
  /** Maximum time to wait before flushing (ms) */
  maxWaitMs: 50,
}

export class SerialWebSocketServer implements Disposable {
  public readonly server: Server<WebSocketData>
  private readonly distWebPath: string
  // Track WebSocket connections by session ID
  private sessionWebSockets: Map<string, Set<ServerWebSocket<WebSocketData>>> = new Map()
  // Message batching buffers
  private messageBuffers: Map<string, string[]> = new Map()
  private flushTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  static async createServer(): Promise<SerialWebSocketServer> {
    const instance = new SerialWebSocketServer()
    return instance
  }

  private constructor() {
    this.distWebPath = getDistWebPath()
    this.server = this.startWebServer()
    // Register broadcast callback with manager
    manager.setBroadcastCallback((sessionId, data) => {
      this.broadcastToSession(sessionId, data)
    })
  }

  /**
   * Broadcast data to all WebSocket clients connected to a session.
   * Uses batching to reduce overhead for high-frequency serial data.
   */
  private broadcastToSession(sessionId: string, data: string): void {
    const sockets = this.sessionWebSockets.get(sessionId)
    if (!sockets || sockets.size === 0) return

    // Get or create message buffer for this session
    let buffer = this.messageBuffers.get(sessionId)
    if (!buffer) {
      buffer = []
      this.messageBuffers.set(sessionId, buffer)
    }

    // Add data to buffer
    buffer.push(data)

    // Flush if batch is full
    if (buffer.length >= BATCH_CONFIG.maxBatchSize) {
      this.flushSession(sessionId)
      return
    }

    // Schedule flush if not already scheduled
    if (!this.flushTimers.has(sessionId)) {
      const timer = setTimeout(() => {
        this.flushSession(sessionId)
      }, BATCH_CONFIG.maxWaitMs)
      this.flushTimers.set(sessionId, timer)
    }
  }

  /**
   * Flush buffered messages to all WebSocket clients for a session.
   */
  private flushSession(sessionId: string): void {
    // Clear timer
    const timer = this.flushTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.flushTimers.delete(sessionId)
    }

    // Get and clear buffer
    const buffer = this.messageBuffers.get(sessionId)
    if (!buffer || buffer.length === 0) return

    this.messageBuffers.delete(sessionId)

    // Combine all buffered messages
    const combinedData = buffer.join('')

    // Send to all connected sockets
    const sockets = this.sessionWebSockets.get(sessionId)
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === 1) { // OPEN
          ws.send(combinedData)
        }
      }
    }
  }

  private serveFile(path: string): Response | null {
    try {
      const file = Bun.file(path)
      // Use size >= 0 as a synchronous check for file existence
      if (file.size >= 0) {
        const ext = path.split('.').pop()?.toLowerCase()
        const mimeTypes: Record<string, string> = {
          html: 'text/html',
          js: 'application/javascript',
          css: 'text/css',
          json: 'application/json',
          png: 'image/png',
          ico: 'image/x-icon',
          svg: 'image/svg+xml',
        }
        return new Response(file, {
          headers: {
            'Content-Type': mimeTypes[ext ?? ''] ?? 'application/octet-stream',
          },
        })
      }
    } catch {
      // File not found or error
    }
    return null
  }

  private startWebServer(): Server<WebSocketData> {
    return Bun.serve<WebSocketData>({
      port: 0,
      hostname: process.env.SERIAL_WEB_HOSTNAME ?? 'localhost',

      fetch: (req) => {
        const url = new URL(req.url)

        // WebSocket upgrade
        if (url.pathname.startsWith('/ws/serial/')) {
          const sessionId = url.pathname.replace('/ws/serial/', '')
          const success = this.server.upgrade(req, {
            data: { sessionId },
          })
          if (!success) {
            return new Response('WebSocket upgrade failed', { status: 500 })
          }
          return
        }

        // Serve static files from dist/web
        let filePath: string
        if (url.pathname === '/' || url.pathname === '/index.html') {
          filePath = join(this.distWebPath, 'index.html')
        } else if (url.pathname.startsWith('/assets/')) {
          filePath = join(this.distWebPath, url.pathname)
        } else if (url.pathname === '/api/sessions') {
          // Session list API endpoint
          const sessions = manager.list()
          return new Response(JSON.stringify({ sessions }), {
            headers: { 'Content-Type': 'application/json' },
          })
        } else {
          filePath = join(this.distWebPath, url.pathname)
        }

        const response = this.serveFile(filePath)
        if (response) return response

        // Fallback to index.html for SPA routing (serial/:id paths in browser)
        if (req.method === 'GET') {
          const indexPath = join(this.distWebPath, 'index.html')
          const indexResponse = this.serveFile(indexPath)
          if (indexResponse) return indexResponse
        }

        return new Response('Not found', { status: 404 })
      },

      websocket: {
        message: (ws, message) => {
          const sessionId = ws.data?.sessionId
          if (!sessionId || typeof message !== 'string') return
          manager.write(sessionId, message)
        },
        open: (ws) => {
          const sessionId = ws.data?.sessionId
          if (!sessionId) {
            ws.close(1008, 'Missing session ID')
            return
          }
          const session = manager.get(sessionId)
          if (!session) {
            ws.send(JSON.stringify({ type: 'error', message: `Session '${sessionId}' not found` }))
            ws.close(1008, 'Session not found')
            return
          }
          // Track this WebSocket for the session
          let sockets = this.sessionWebSockets.get(sessionId)
          if (!sockets) {
            sockets = new Set()
            this.sessionWebSockets.set(sessionId, sockets)
          }
          sockets.add(ws)
          // Send initial connection message with session info
          ws.send(
            JSON.stringify({
              type: 'connected',
              session: {
                id: session.id,
                title: session.title,
                port: session.port,
                baudrate: session.baudrate,
                status: session.status,
              },
            })
          )
        },
        close: (ws) => {
          const sessionId = ws.data?.sessionId
          if (sessionId) {
            const sockets = this.sessionWebSockets.get(sessionId)
            if (sockets) {
              sockets.delete(ws)
              if (sockets.size === 0) {
                this.sessionWebSockets.delete(sessionId)
              }
            }
            // Flush any pending messages for this session
            this.flushSession(sessionId)
          }
        },
      },
    })
  }

  get url(): URL {
    return this.server.url
  }

  [Symbol.dispose]() {
    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearTimeout(timer)
    }
    this.flushTimers.clear()
    this.messageBuffers.clear()
    manager.setBroadcastCallback(null)
    this.server.stop()
  }
}

let _server: SerialWebSocketServer | undefined

export async function getOrCreateWebServer(): Promise<SerialWebSocketServer> {
  if (!_server) {
    _server = await SerialWebSocketServer.createServer()
  }
  return _server
}

export function resetWebServer(): void {
  if (_server) {
    _server[Symbol.dispose]()
    _server = undefined
  }
}
