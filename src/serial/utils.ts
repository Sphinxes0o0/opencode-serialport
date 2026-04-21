export function buildSessionNotFoundError(id: string): Error {
  return new Error(`Serial session '${id}' not found. Use serial_list to see active sessions.`)
}

export function withSession<TSession, TResult>(
  manager: { getSession(id: string): TSession | null },
  id: string,
  fn: (session: TSession) => TResult,
  defaultValue: TResult
): TResult {
  const session = manager.getSession(id)
  if (!session) return defaultValue
  return fn(session)
}

const SESSION_ID_BYTE_LENGTH = 16

export function generateId(prefix: string = 'serial'): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTE_LENGTH)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${prefix}_${hex}`
}

export function formatLine(line: string, lineNumber: number, maxLength: number): string {
  const truncated = line.length > maxLength ? line.slice(0, maxLength) + '...' : line
  return `${lineNumber.toString().padStart(6)} | ${truncated}`
}

export function formatSessionInfo(session: {
  id: string
  title: string
  port: string
  baudrate: number
  status: string
  lineCount: number
  createdAt: string
}): string[] {
  return [
    `[${session.id}] ${session.title}`,
    `  Port: ${session.port} @ ${session.baudrate} baud`,
    `  Status: ${session.status} | Lines: ${session.lineCount}`,
    `  Created: ${new Date(session.createdAt).toLocaleString()}`,
  ]
}
