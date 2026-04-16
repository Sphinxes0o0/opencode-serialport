import type { OpencodeClient } from '@opencode-ai/sdk'
import { SessionLifecycleManager } from './session-lifecycle'
import { OutputManager } from './output-manager'
import type {
  SerialSessionInfo,
  SerialSession,
  ReadResult,
  SearchResult,
  SpawnOptions,
} from './types'
import { withSession } from './utils'

// Callback type for broadcasting serial data to WebSocket clients
type BroadcastCallback = (sessionId: string, data: string) => void

class SerialManager {
  private lifecycleManager = new SessionLifecycleManager()
  private outputManager = new OutputManager()
  private broadcastCallback: BroadcastCallback | null = null

  init(_client: OpencodeClient): void {
    // NotificationManager can be added here when needed
  }

  /**
   * Set a callback to be invoked when serial data is received.
   * The callback receives the session ID and the data string.
   */
  setBroadcastCallback(callback: BroadcastCallback | null): void {
    this.broadcastCallback = callback
  }

  clearAllSessions(): void {
    this.lifecycleManager.clearAllSessions()
  }

  async open(
    opts: SpawnOptions
  ): Promise<{ session: SerialSession; info: SerialSessionInfo }> {
    const session = await this.lifecycleManager.open(
      opts,
      (s, data) => {
        // Broadcast to WebSocket clients if callback is registered
        if (this.broadcastCallback) {
          this.broadcastCallback(s.id, data)
        }
      },
      (s) => {
        // onDisconnect callback — could broadcast disconnect event
        if (this.broadcastCallback) {
          this.broadcastCallback(s.id, '\n--- DISCONNECTED ---\n')
        }
      }
    )
    return { session, info: this.lifecycleManager.toInfo(session) }
  }

  write(id: string, data: string): boolean {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => this.outputManager.write(session, data),
      false
    )
  }

  read(id: string, offset: number = 0, limit?: number): ReadResult | null {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => this.outputManager.read(session, offset, limit),
      null
    )
  }

  search(
    id: string,
    pattern: RegExp,
    offset: number = 0,
    limit?: number
  ): SearchResult | null {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => this.outputManager.search(session, pattern, offset, limit),
      null
    )
  }

  list(): SerialSessionInfo[] {
    return this.lifecycleManager
      .listSessions()
      .map((s) => this.lifecycleManager.toInfo(s))
  }

  get(id: string): SerialSessionInfo | null {
    return withSession(
      this.lifecycleManager,
      id,
      (session) => this.lifecycleManager.toInfo(session),
      null
    )
  }

  close(id: string, cleanup: boolean = false): boolean {
    return this.lifecycleManager.close(id, cleanup)
  }

  cleanupBySession(parentSessionId: string): void {
    this.lifecycleManager.cleanupBySession(parentSessionId)
  }
}

export const manager = new SerialManager()

export function initManager(_opcClient: OpencodeClient): void {
  manager.init(_opcClient)
}
