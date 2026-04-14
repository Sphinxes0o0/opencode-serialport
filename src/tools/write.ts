import { tool } from '@opencode-ai/plugin'
import { manager } from '../serial/manager'
import { buildSessionNotFoundError } from '../serial/utils'

const DESCRIPTION = 'Write data to an open serial port. Supports escape sequences.'

function parseEscapeSequences(data: string): string {
  return data
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\\\/g, '\\')
}

export const serialWrite = tool({
  description: DESCRIPTION,
  args: {
    id: tool.schema.string().describe('Session ID (e.g., serial_a1b2c3d4)'),
    data: tool.schema
      .string()
      .describe(
        'Data to send. Escape sequences: \\n \\r \\t \\xNN \\uNNNN are decoded.'
      ),
    raw: tool.schema
      .boolean()
      .optional()
      .describe('If true, do not parse escape sequences (default: false)'),
  },
  async execute(args) {
    const session = manager.get(args.id)
    if (!session) {
      throw buildSessionNotFoundError(args.id)
    }

    if (session.status !== 'open') {
      throw new Error(`Serial session '${args.id}' is not open (status: ${session.status})`)
    }

    const data = args.raw ? args.data : parseEscapeSequences(args.data)
    const success = manager.write(args.id, data)

    if (!success) {
      throw new Error(`Failed to write to serial session '${args.id}'`)
    }

    const preview =
      data.length > 40 ? data.slice(0, 40) + '...' : data
    return [
      `<serial_written>`,
      `ID: ${args.id}`,
      `Bytes: ${data.length}`,
      `Preview: ${preview.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`,
      `</serial_written>`,
    ].join('\n')
  },
})
