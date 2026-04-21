import { tool } from '@opencode-ai/plugin'
import { manager } from '../serial/manager'
import { checkPortPermission } from '../serial/permissions'

const DESCRIPTION =
  'Open a serial port and establish a bidirectional communication session.'

// Validation constants
const VALID_BAUDRATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]
const VALID_DATABITS = [5, 6, 7, 8]
const VALID_STOPBITS = [1, 2] as const

function validatePortPath(path: string): boolean {
  // Check for shell metacharacters (defense in depth with buildSttyCommand sanitization)
  if (/[;|`$(){}[\]<>\\!#*?"' ]/.test(path)) return false
  // Check for valid port path patterns
  const patterns = [
    /^\/dev\/cu\./,      // macOS
    /^\/dev\/ttyUSB/,    // Linux USB
    /^\/dev\/ttyACM/,    // Linux ACM
    /^\/dev\/ttyS/,     // Linux serial
    /^\/dev\/serial/,    // Linux serial/by-id
    /^COM\d+$/i,         // Windows COM port
  ]
  return patterns.some(p => p.test(path))
}

function validateBaudrate(rate: number): boolean {
  return VALID_BAUDRATES.includes(rate)
}

function validateDatabits(bits: number): boolean {
  return VALID_DATABITS.includes(bits)
}

function validateStopbits(bits: number): boolean {
  return (VALID_STOPBITS as readonly number[]).includes(bits)
}

export const serialOpen = tool({
  description: DESCRIPTION,
  args: {
    port: tool.schema
      .string()
      .describe('Serial port path (e.g., /dev/cu.usbserial-0001)'),
    baudrate: tool.schema
      .number()
      .optional()
      .describe(`Baud rate (default: 115200, valid: ${VALID_BAUDRATES.join(', ')})`),
    databits: tool.schema
      .number()
      .optional()
      .describe(`Data bits: ${VALID_DATABITS.join(', ')} (default: 8)`),
    parity: tool.schema
      .enum(['none', 'even', 'odd', 'mark', 'space'])
      .optional()
      .describe('Parity (default: none)'),
    stopbits: tool.schema
      .number()
      .optional()
      .describe(`Stop bits: ${VALID_STOPBITS.join(', ')} (default: 1)`),
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
    // Validate port path
    if (!validatePortPath(args.port)) {
      throw new Error(
        `Invalid port path: "${args.port}". Valid paths start with /dev/cu., /dev/ttyUSB, /dev/ttyACM, /dev/ttyS, /dev/serial, or COM (Windows).`
      )
    }

    // Validate baudrate if provided
    const baudrate = args.baudrate ?? 115200
    if (!validateBaudrate(baudrate)) {
      throw new Error(
        `Invalid baudrate: ${baudrate}. Valid rates: ${VALID_BAUDRATES.join(', ')}`
      )
    }

    // Validate databits if provided
    const databits = args.databits ?? 8
    if (!validateDatabits(databits)) {
      throw new Error(
        `Invalid databits: ${databits}. Valid values: ${VALID_DATABITS.join(', ')}`
      )
    }

    // Validate stopbits if provided
    const stopbits: 1 | 2 = (args.stopbits ?? 1) as 1 | 2
    if (!validateStopbits(stopbits)) {
      throw new Error(
        `Invalid stopbits: ${stopbits}. Valid values: ${VALID_STOPBITS.join(', ')}`
      )
    }

    await checkPortPermission(args.port)

    const { info } = await manager.open({
      port: args.port,
      baudrate,
      databits: databits as 5 | 6 | 7 | 8,
      parity: args.parity ?? 'none',
      stopbits,
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
