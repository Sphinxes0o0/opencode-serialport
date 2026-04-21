import { tool } from '@opencode-ai/plugin'
import { manager } from '../serial/manager'
import { buildSessionNotFoundError } from '../serial/utils'

const DESCRIPTION =
  'Configure or query settings of an open serial port session.'

export const serialConfig = tool({
  description: DESCRIPTION,
  args: {
    id: tool.schema
      .string()
      .describe('Session ID (e.g., serial_a1b2c3d4)'),
    baudrate: tool.schema
      .number()
      .optional()
      .describe('Change baud rate (requires reopen)'),
  },
  async execute(args, _ctx) {
    const session = manager.get(args.id)
    if (!session) {
      throw buildSessionNotFoundError(args.id)
    }

    const info: string[] = [
      `<serial_config id="${args.id}">`,
      `Port: ${session.port}`,
      `Baudrate: ${session.baudrate}`,
      `Databits: ${session.databits}`,
      `Parity: ${session.parity}`,
      `Stopbits: ${session.stopbits}`,
      `FlowControl: ${session.flowControl}`,
      `Status: ${session.status}`,
      `LineCount: ${session.lineCount}`,
      `</serial_config>`,
    ]

    // If baudrate change requested, suggest reopen (stty doesn't support live rate change)
    if (args.baudrate && args.baudrate !== session.baudrate) {
      info.push(
        '',
        `Note: To change baudrate, close and reopen the port with the new rate.`
      )
    }

    return info.join('\n')
  },
})
