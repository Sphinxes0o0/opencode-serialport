import { tool } from '@opencode-ai/plugin'
import { manager } from '../serial/manager'
import { checkPortPermission } from '../serial/permissions'

const DESCRIPTION =
  'Open a serial port and establish a bidirectional communication session.'

export const serialOpen = tool({
  description: DESCRIPTION,
  args: {
    port: tool.schema
      .string()
      .describe('Serial port path (e.g., /dev/cu.usbserial-0001)'),
    baudrate: tool.schema
      .number()
      .optional()
      .describe('Baud rate (default: 115200)'),
    databits: tool.schema
      .number()
      .optional()
      .describe('Data bits: 5, 6, 7, or 8 (default: 8)'),
    parity: tool.schema
      .enum(['none', 'even', 'odd', 'mark', 'space'])
      .optional()
      .describe('Parity (default: none)'),
    stopbits: tool.schema
      .number()
      .optional()
      .describe('Stop bits: 1 or 2 (default: 1)'),
    flowControl: tool.schema
      .enum(['none', 'hardware', 'software'])
      .optional()
      .describe('Flow control (default: none)'),
    title: tool.schema.string().optional().describe('Human-readable title'),
    description: tool.schema
      .string()
      .optional()
      .describe('Purpose in 5-10 words'),
    notifyOnDisconnect: tool.schema
      .boolean()
      .optional()
      .describe('Notify when port disconnects (default: false)'),
  },
  async execute(args, ctx) {
    await checkPortPermission(args.port)

    const { info } = await manager.open({
      port: args.port,
      baudrate: args.baudrate ?? 115200,
      databits: (args.databits as 5 | 6 | 7 | 8) ?? 8,
      parity: args.parity ?? 'none',
      stopbits: (args.stopbits as 1 | 2) ?? 1,
      flowControl: args.flowControl ?? 'none',
      title: args.title,
      description: args.description,
      parentSessionId: ctx.sessionID,
      parentAgent: ctx.agent,
      notifyOnDisconnect: args.notifyOnDisconnect,
    })

    return [
      `<serial_opened>`,
      `ID: ${info.id}`,
      `Title: ${info.title}`,
      `Port: ${info.port}`,
      `Baudrate: ${info.baudrate}`,
      `Settings: ${info.databits}${info.parity[0]}${info.stopbits}`,
      `FlowControl: ${info.flowControl}`,
      `Status: ${info.status}`,
      `</serial_opened>`,
    ].join('\n')
  },
})
