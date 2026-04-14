import type { Server } from 'bun'
import { join } from 'path'
import { manager } from '../../serial/manager'

// Resolve dist/web directory relative to process.cwd()
function getDistWebPath(): string {
  return join(process.cwd(), 'dist', 'web')
}

export class SerialWebSocketServer implements Disposable {
  public readonly server: Server
  private readonly distWebPath: string

  static async createServer(): Promise<SerialWebSocketServer> {
    const instance = new SerialWebSocketServer()
    return instance
  }

  private constructor() {
    this.distWebPath = getDistWebPath()
    this.server = this.startWebServer()
  }

  private serveFile(path: string): Response | null {
    try {
      const file = Bun.file(path)
      if (file.exists) {
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

  private startWebServer(): Server {
    return Bun.serve({
      port: 0,
      hostname: process.env.SERIAL_WEB_HOSTNAME ?? '::1',

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
          const sessionId = (ws.data as { sessionId: string })?.sessionId
          if (!sessionId || typeof message !== 'string') return
          manager.write(sessionId, message)
        },
        open: (ws) => {
          const sessionId = (ws.data as { sessionId: string })?.sessionId
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
          ws.subscribe(`serial:${sessionId}`)
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
          const sessionId = (ws.data as { sessionId: string })?.sessionId
          if (sessionId) {
            ws.unsubscribe(`serial:${sessionId}`)
          }
        },
      },
    })
  }

  get url(): URL {
    return this.server.url
  }

  [Symbol.dispose]() {
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
