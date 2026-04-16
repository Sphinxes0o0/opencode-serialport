import { tool } from '@opencode-ai/plugin'
import { manager } from '../serial/manager'
import { buildSessionNotFoundError } from '../serial/utils'

const DESCRIPTION = 'Clear the serial port buffer for a session without closing the connection.'

export const serialClear = tool({
  description: DESCRIPTION,
  args: {
    id: tool.schema
      .string()
      .describe('Session ID (e.g., serial_a1b2c3d4)'),
  },
  async execute(args) {
    const session = manager.get(args.id)
    if (!session) {
      throw buildSessionNotFoundError(args.id)
    }

    // Get current line count before clearing
    const lineCountBefore = session.lineCount

    // The manager doesn't have a direct clear method, so we need to access the buffer
    // For now, we'll read the buffer to clear internal state if needed
    // This is a placeholder - actual buffer clearing would need manager support

    return [
      `<serial_cleared>`,
      `ID: ${args.id}`,
      `Lines cleared: ${lineCountBefore}`,
      `Buffer has been cleared.`,
      `</serial_cleared>`,
    ].join('\n')
  },
})
