import type { PluginClient } from '../types'

let _client: PluginClient | null = null
let _directory: string | null = null

export function initPermissions(client: PluginClient, directory: string): void {
  _client = client
  _directory = directory
}

interface SerialPermissionEntry {
  [portPattern: string]: 'allow' | 'deny' | 'ask'
}

interface PermissionConfig {
  serial?: SerialPermissionEntry
}

async function getPermissionConfig(): Promise<PermissionConfig> {
  if (!_client) return {}
  try {
    const response = await _client.config.get()
    if (response.error || !response.data) return {}
    return (response.data as { permission?: PermissionConfig }).permission ?? {}
  } catch {
    return {}
  }
}

async function showToast(
  message: string,
  variant: 'info' | 'success' | 'error' = 'error'
): Promise<void> {
  if (!_client) return
  try {
    await _client.tui.showToast({ body: { message, variant } })
  } catch {
    // Ignore
  }
}

async function denyWithToast(msg: string, details?: string): Promise<never> {
  await showToast(msg, 'error')
  throw new Error(details ? `${msg} ${details}` : msg)
}

function matchPortPattern(port: string, pattern: string): boolean {
  if (pattern === '*') return true
  // Escape special regex characters first, then convert glob wildcards
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  )
  return regex.test(port)
}

export async function checkPortPermission(port: string): Promise<void> {
  const config = await getPermissionConfig()
  const serialPerms = config.serial

  if (!serialPerms) return // No restrictions

  // Find matching rule
  for (const [pattern, action] of Object.entries(serialPerms)) {
    if (matchPortPattern(port, pattern)) {
      if (action === 'deny') {
        await denyWithToast(
          `Serial: Port "${port}" is denied by configuration.`
        )
      } else if (action === 'ask') {
        await denyWithToast(
          `Serial: Port "${port}" requires permission (not supported). Configure explicit allow/deny in opencode.json.`
        )
      } else {
        // allow
        return
      }
    }
  }
}
