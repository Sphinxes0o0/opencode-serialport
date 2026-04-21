import { expect, test, describe, beforeEach, afterEach, mock } from 'bun:test'
import { $ } from 'bun'

// Mock the file system operations
const mockFs = {
  openSync: mock(() => 42), // Return a fake file descriptor
  readSync: mock(() => 5),  // Return 5 bytes read
  writeSync: mock(() => 5), // Return 5 bytes written
  closeSync: mock(() => {}),
}

describe('RingBuffer', () => {
  test('should append and read data', () => {
    const { RingBuffer } = require('./src/serial/buffer')
    const buffer = new RingBuffer()

    buffer.append('Hello')
    buffer.append('\nWorld')

    expect(buffer.length).toBe(2)
    expect(buffer.readRaw()).toBe('Hello\nWorld')
  })

  test('should handle empty buffer', () => {
    const { RingBuffer } = require('./src/serial/buffer')
    const buffer = new RingBuffer()

    expect(buffer.length).toBe(0)
    expect(buffer.read()).toEqual([])
  })

  test('should truncate when exceeding max size', () => {
    const { RingBuffer } = require('./src/serial/buffer')
    const buffer = new RingBuffer(10)

    buffer.append('1234567890ABCD')
    expect(buffer.byteLength).toBeLessThanOrEqual(10)
  })

  test('should search lines with regex', () => {
    const { RingBuffer } = require('./src/serial/buffer')
    const buffer = new RingBuffer()

    buffer.append('line1\n')
    buffer.append('line2\n')
    buffer.append('line3\n')

    const matches = buffer.search(/line[12]/)
    expect(matches.length).toBe(2)
    expect(matches[0].text).toBe('line1')
    expect(matches[1].text).toBe('line2')
  })

  test('should clear buffer', () => {
    const { RingBuffer } = require('./src/serial/buffer')
    const buffer = new RingBuffer()

    buffer.append('test')
    buffer.clear()

    expect(buffer.length).toBe(0)
    expect(buffer.readRaw()).toBe('')
  })
})

describe('generateId', () => {
  test('should generate unique IDs with prefix', () => {
    const { generateId } = require('./src/serial/utils')

    const id1 = generateId()
    const id2 = generateId()

    expect(id1).toMatch(/^serial_[a-f0-9]{32}$/)
    expect(id2).toMatch(/^serial_[a-f0-9]{32}$/)
    expect(id1).not.toBe(id2)
  })

  test('should generate ID with custom prefix', () => {
    const { generateId } = require('./src/serial/utils')

    const id = generateId('custom')
    expect(id).toMatch(/^custom_[a-f0-9]{32}$/)
  })
})

describe('formatLine', () => {
  test('should format line with line number', () => {
    const { formatLine } = require('./src/serial/utils')

    const formatted = formatLine('test line', 1, 100)
    expect(formatted).toBe('     1 | test line')
  })

  test('should truncate long lines', () => {
    const { formatLine } = require('./src/serial/utils')

    const longLine = 'a'.repeat(50)
    const formatted = formatLine(longLine, 1, 20)
    // maxLength=20 means content truncated to 20 chars + "..."
    expect(formatted).toContain('...')
    expect(formatted.length).toBeLessThan(longLine.length + 10)
  })
})

describe('matchPortPattern', () => {
  // Import the permission check logic
  const matchPortPattern = (port: string, pattern: string): boolean => {
    if (pattern === '*') return true
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )
    return regex.test(port)
  }

  test('should match exact pattern', () => {
    expect(matchPortPattern('/dev/cu.usbserial-0001', '/dev/cu.usbserial-0001')).toBe(true)
  })

  test('should match glob wildcard', () => {
    expect(matchPortPattern('/dev/cu.usbserial-0001', '/dev/cu.*')).toBe(true)
    expect(matchPortPattern('/dev/cu.usbserial-0002', '/dev/cu.*')).toBe(true)
    expect(matchPortPattern('/dev/ttyUSB0', '/dev/cu.*')).toBe(false)
  })

  test('should match asterisk wildcard', () => {
    expect(matchPortPattern('/dev/ttyUSB0', '/dev/ttyUSB*')).toBe(true)
    expect(matchPortPattern('/dev/ttyUSB1', '/dev/ttyUSB*')).toBe(true)
  })

  test('should match question mark wildcard', () => {
    expect(matchPortPattern('/dev/cu.usb-1', '/dev/cu.usb-?')).toBe(true)
    expect(matchPortPattern('/dev/cu.usb-12', '/dev/cu.usb-?')).toBe(false)
  })

  test('should match asterisk only', () => {
    expect(matchPortPattern('/dev/anything', '*')).toBe(true)
  })
})

describe('parseEscapeSequences', () => {
  const parseEscapeSequences = (data: string): string => {
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

  test('should parse \\n', () => {
    expect(parseEscapeSequences('line1\\nline2')).toBe('line1\nline2')
  })

  test('should parse \\r', () => {
    expect(parseEscapeSequences('line1\\rline2')).toBe('line1\rline2')
  })

  test('should parse \\t', () => {
    expect(parseEscapeSequences('col1\\tcol2')).toBe('col1\tcol2')
  })

  test('should parse \\xNN hex codes', () => {
    expect(parseEscapeSequences('\\x41\\x42')).toBe('AB')
    expect(parseEscapeSequences('\\x00\\xFF')).toBe('\x00\xFF')
  })

  test('should parse \\uNNNN unicode', () => {
    expect(parseEscapeSequences('\\u0041\\u0042')).toBe('AB')
  })

  test('should parse \\\\ as backslash', () => {
    // \\\\ in JS string = two literal backslashes -> one backslash
    expect(parseEscapeSequences('a\\\\b')).toBe('a\\b')
  })
})

describe('stty command builder', () => {
  // Replicate the stty command building logic
  const buildSttyCommand = (session: {
    port: string
    baudrate: number
    databits: number
    parity: string
    stopbits: number
  }): string => {
    const parts: string[] = ['stty', '-f', session.port]

    parts.push(String(session.baudrate))
    parts.push(`cs${session.databits}`)

    if (session.parity === 'none') {
      parts.push('-parenb')
    } else if (session.parity === 'even') {
      parts.push('parenb', '-parodd')
    } else if (session.parity === 'odd') {
      parts.push('parenb', 'parodd')
    }

    if (session.stopbits === 2) {
      parts.push('cstopb')
    } else {
      parts.push('-cstopb')
    }

    parts.push('-echo')
    parts.push('raw')

    return parts.join(' ')
  }

  test('should build basic stty command', () => {
    const cmd = buildSttyCommand({
      port: '/dev/cu.usbserial-0001',
      baudrate: 9600,
      databits: 8,
      parity: 'none',
      stopbits: 1,
    })

    expect(cmd).toContain('stty')
    expect(cmd).toContain('-f')
    expect(cmd).toContain('/dev/cu.usbserial-0001')
    expect(cmd).toContain('9600')
    expect(cmd).toContain('cs8')
    expect(cmd).toContain('-parenb')
    expect(cmd).toContain('-cstopb')
    expect(cmd).toContain('-echo')
    expect(cmd).toEndWith('raw')
  })

  test('should build stty command with even parity', () => {
    const cmd = buildSttyCommand({
      port: '/dev/cu.usbserial-0001',
      baudrate: 115200,
      databits: 7,
      parity: 'even',
      stopbits: 1,
    })

    expect(cmd).toContain('parenb')
    expect(cmd).toContain('-parodd')
  })

  test('should build stty command with 2 stop bits', () => {
    const cmd = buildSttyCommand({
      port: '/dev/cu.usbserial-0001',
      baudrate: 9600,
      databits: 8,
      parity: 'none',
      stopbits: 2,
    })

    expect(cmd).toContain('cstopb')
  })
})

describe('Session ID generation', () => {
  test('should generate session IDs with correct format', () => {
    const { generateId } = require('./src/serial/utils')

    // Generate multiple IDs and check format
    for (let i = 0; i < 10; i++) {
      const id = generateId()
      expect(id).toMatch(/^serial_[a-f0-9]{32}$/)
    }
  })

  test('should generate unique IDs', () => {
    const { generateId } = require('./src/serial/utils')

    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(100)
  })
})
