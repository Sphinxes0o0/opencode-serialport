import { tool } from '@opencode-ai/plugin'
import { manager } from '../serial/manager'
import { buildSessionNotFoundError } from '../serial/utils'

const DESCRIPTION = 'Close an open serial port connection.'

export const serialClose = tool({
  description: DESCRIPTION,
  args: {
    id: tool.schema
      .string()
      .describe('Session ID (e.g., serial_a1b2c3d4)'),
    cleanup: tool.schema
      .boolean()
      .optional()
      .describe('If true, removes session and frees buffer (default: false)'),
  },
  async execute(args) {
    const session = manager.get(args.id)
    if (!session) {
      throw buildSessionNotFoundError(args.id)
    }

    const wasOpen = session.status === 'open'
    const cleanup = args.cleanup ?? false
    const success = manager.close(args.id, cleanup)

    if (!success) {
      throw new Error(`Failed to close serial session '${args.id}'`)
    }

    const action = wasOpen ? 'Closed' : 'Cleaned up'
    const cleanupNote = cleanup ? ' (session removed)' : ' (session retained)'

    return [
      `<serial_closed>`,
      `${action}: ${args.id}${cleanupNote}`,
      `Title: ${session.title}`,
      `Port: ${session.port}`,
      `Final lines: ${session.lineCount}`,
      `</serial_closed>`,
    ].join('\n')
  },
})
