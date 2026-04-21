import { tool } from '@opencode-ai/plugin'
import { manager } from '../serial/manager'
import { buildSessionNotFoundError } from '../serial/utils'

const DESCRIPTION = 'Write data to an open serial port. Supports escape sequences.'

const MAX_DATA_LENGTH = 65536 // 64KB max write size

function parseEscapeSequences(data: string): string {
  return data
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => {
      const code = parseInt(hex, 16)
      if (code > 0xFF) return '\\x' + hex // Out of range, keep as-is
      return String.fromCharCode(code)
    })
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      const code = parseInt(hex, 16)
      if (code > 0x10FFFF) return '\\u' + hex // Out of range, keep as-is
      return String.fromCharCode(code)
    })
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
  async execute(args, _ctx) {
    // Validate data length
    if (args.data.length > MAX_DATA_LENGTH) {
      throw new Error(
        `Data too large: ${args.data.length} bytes. Maximum is ${MAX_DATA_LENGTH} bytes.`
      )
    }

    // Validate session exists
    const session = manager.get(args.id)
    if (!session) {
      throw buildSessionNotFoundError(args.id)
    }

    // Validate session is open
    if (session.status !== 'open') {
      throw new Error(`Serial session '${args.id}' is not open (status: ${session.status})`)
    }

    // Parse escape sequences if not raw
    const data = args.raw ? args.data : parseEscapeSequences(args.data)

    // Double-check parsed data length
    if (data.length > MAX_DATA_LENGTH) {
      throw new Error(
        `Data too large after escape parsing: ${data.length} bytes. Maximum is ${MAX_DATA_LENGTH} bytes.`
      )
    }

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
