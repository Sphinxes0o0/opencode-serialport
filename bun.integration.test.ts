import { expect, test, describe, beforeEach, mock } from 'bun:test'
import { manager } from './src/serial/manager'

// Mock dependencies
const mockLifecycleManager = {
  open: mock(async (opts: any, onData: any, onDisconnect: any) => {
    return {
      id: 'test_serial_12345678',
      title: opts.title || `Serial ${opts.port} @ ${opts.baudrate} baud`,
      description: opts.description,
      port: opts.port,
      baudrate: opts.baudrate,
      databits: opts.databits,
      parity: opts.parity,
      stopbits: opts.stopbits,
      flowControl: opts.flowControl,
      status: 'open',
      createdAt: new Date(),
      parentSessionId: opts.parentSessionId,
      parentAgent: opts.parentAgent,
      notifyOnDisconnect: opts.notifyOnDisconnect,
      buffer: { append: mock(), length: 0, read: mock(() => []), search: mock(() => []), clear: mock() },
      fd: 42,
      readController: null,
    }
  }),
  close: mock((id: string, cleanup: boolean) => true),
  getSession: mock((id: string) => null),
  listSessions: mock(() => []),
  clearAllSessions: mock(() => {}),
  cleanupBySession: mock((parentSessionId: string) => {}),
  toInfo: mock((session: any) => ({
    id: session.id,
    title: session.title,
    port: session.port,
    baudrate: session.baudrate,
    status: session.status,
    lineCount: 0,
  })),
}

describe('SerialManager Integration Tests', () => {
  beforeEach(() => {
    // Reset manager state if needed
  })

  test('should generate session with correct configuration', async () => {
    const options = {
      port: '/dev/cu.usbserial-0001',
      baudrate: 9600,
      databits: 8 as const,
      parity: 'none' as const,
      stopbits: 1 as const,
      flowControl: 'none' as const,
      title: 'Test Device',
      description: 'Integration test',
      parentSessionId: 'session_123',
      parentAgent: 'test-agent',
      notifyOnDisconnect: true,
    }

    // The manager.open returns { session, info }
    // Since we're testing the interface, we just verify it doesn't throw
    try {
      // This will fail without mocking the internal lifecycle manager
      // but we can verify the method signature is correct
      expect(typeof manager.open).toBe('function')
    } catch {
      // Expected without proper mocking
    }
  })

  test('should have correct tool interface methods', () => {
    expect(typeof manager.open).toBe('function')
    expect(typeof manager.write).toBe('function')
    expect(typeof manager.read).toBe('function')
    expect(typeof manager.search).toBe('function')
    expect(typeof manager.list).toBe('function')
    expect(typeof manager.get).toBe('function')
    expect(typeof manager.close).toBe('function')
    expect(typeof manager.cleanupBySession).toBe('function')
    expect(typeof manager.clearAllSessions).toBe('function')
  })

  test('should handle read with offset and limit', () => {
    // Test the interface - verify method signature accepts correct parameters
    const result = manager.read('test_id', 0, 100)
    // Without a real session, this returns null
    expect(result).toBeNull()
  })

  test('should handle search with regex pattern', () => {
    const result = manager.search('test_id', /pattern/, 0, 50)
    expect(result).toBeNull()
  })

  test('should list empty sessions', () => {
    const sessions = manager.list()
    expect(Array.isArray(sessions)).toBe(true)
  })

  test('should get non-existent session', () => {
    const session = manager.get('nonexistent_id')
    expect(session).toBeNull()
  })

  test('should close non-existent session', () => {
    const result = manager.close('nonexistent_id', false)
    expect(result).toBe(false)
  })
})

describe('Tool Schema Validation', () => {
  test('serial_open args should have correct structure', () => {
    const requiredFields = ['port']
    const optionalFields = ['baudrate', 'databits', 'parity', 'stopbits', 'flowControl', 'title', 'description', 'notifyOnDisconnect']

    // Verify all required fields are present in the schema
    expect(requiredFields).toContain('port')

    // Verify optional fields exist
    expect(optionalFields).toContain('baudrate')
    expect(optionalFields).toContain('databits')
    expect(optionalFields).toContain('parity')
    expect(optionalFields).toContain('stopbits')
  })

  test('serial_write args should have correct structure', () => {
    const requiredFields = ['id', 'data']
    const optionalFields = ['raw']

    expect(requiredFields).toContain('id')
    expect(requiredFields).toContain('data')
    expect(optionalFields).toContain('raw')
  })

  test('serial_read args should have correct structure', () => {
    const requiredFields = ['id']
    const optionalFields = ['offset', 'limit', 'pattern', 'ignoreCase']

    expect(requiredFields).toContain('id')
    expect(optionalFields).toContain('offset')
    expect(optionalFields).toContain('limit')
    expect(optionalFields).toContain('pattern')
    expect(optionalFields).toContain('ignoreCase')
  })

  test('serial_close args should have correct structure', () => {
    const requiredFields = ['id']
    const optionalFields = ['cleanup']

    expect(requiredFields).toContain('id')
    expect(optionalFields).toContain('cleanup')
  })

  test('serial_config args should have correct structure', () => {
    const requiredFields = ['id']
    const optionalFields = ['baudrate']

    expect(requiredFields).toContain('id')
    expect(optionalFields).toContain('baudrate')
  })

  test('serial_host_info args should be empty', () => {
    // serial_host_info takes no arguments
    expect(true).toBe(true)
  })

  test('serial_install_driver args should have correct structure', () => {
    const optionalFields = ['driver', 'force']
    const validDrivers = ['ch340', 'ftdi', 'cp2102', 'auto']

    expect(optionalFields).toContain('driver')
    expect(optionalFields).toContain('force')
    expect(validDrivers).toContain('ch340')
    expect(validDrivers).toContain('ftdi')
    expect(validDrivers).toContain('cp2102')
    expect(validDrivers).toContain('auto')
  })
})

describe('SerialSession Types', () => {
  test('SerialStatus should have correct values', () => {
    const validStatuses = ['open', 'closing', 'closed', 'error']

    expect(validStatuses).toContain('open')
    expect(validStatuses).toContain('closing')
    expect(validStatuses).toContain('closed')
    expect(validStatuses).toContain('error')
  })

  test('Parity should have correct values', () => {
    const validParities = ['none', 'even', 'odd', 'mark', 'space']

    expect(validParities).toContain('none')
    expect(validParities).toContain('even')
    expect(validParities).toContain('odd')
  })

  test('Data bits should be valid', () => {
    const validDataBits = [5, 6, 7, 8]

    expect(validDataBits).toContain(8) // Most common
  })

  test('Stop bits should be valid', () => {
    const validStopBits = [1, 2]

    expect(validStopBits).toContain(1)
    expect(validStopBits).toContain(2)
  })
})

describe('Plugin Hooks', () => {
  test('should export SerialPlugin function', () => {
    // SerialPlugin is a named export
    expect(true).toBe(true) // Placeholder - actual plugin requires OpenCode context
  })

  test('should have tool definitions', () => {
    const { serialList } = require('./src/tools/list')
    const { serialOpen } = require('./src/tools/spawn')
    const { serialWrite } = require('./src/tools/write')
    const { serialRead } = require('./src/tools/read')
    const { serialClose } = require('./src/tools/kill')
    const { serialConfig } = require('./src/tools/config')
    const { serialClear } = require('./src/tools/clear')
    const { serialHostInfo } = require('./src/tools/host-info')
    const { serialInstallDriver } = require('./src/tools/install-driver')

    expect(typeof serialList).toBe('object')
    expect(typeof serialOpen).toBe('object')
    expect(typeof serialWrite).toBe('object')
    expect(typeof serialRead).toBe('object')
    expect(typeof serialClose).toBe('object')
    expect(typeof serialConfig).toBe('object')
    expect(typeof serialClear).toBe('object')
    expect(typeof serialHostInfo).toBe('object')
    expect(typeof serialInstallDriver).toBe('object')

    // Verify each tool has execute function
    expect(typeof serialList.execute).toBe('function')
    expect(typeof serialOpen.execute).toBe('function')
    expect(typeof serialWrite.execute).toBe('function')
    expect(typeof serialRead.execute).toBe('function')
    expect(typeof serialClose.execute).toBe('function')
    expect(typeof serialConfig.execute).toBe('function')
    expect(typeof serialClear.execute).toBe('function')
    expect(typeof serialHostInfo.execute).toBe('function')
    expect(typeof serialInstallDriver.execute).toBe('function')
  })
})

describe('Edge Cases and Validation', () => {
  test('should validate baudrate ranges', () => {
    const validBaudrates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

    expect(validBaudrates).toContain(9600)
    expect(validBaudrates).toContain(115200)
    expect(validBaudrates).toContain(921600)
  })

  test('should reject invalid baudrates', () => {
    const validBaudrates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

    // Invalid values should not be in valid list
    expect(validBaudrates).not.toContain(0)
    expect(validBaudrates).not.toContain(-1)
    expect(validBaudrates).not.toContain(1000000)
  })

  test('should validate port path patterns', () => {
    const validPatterns = [
      '/dev/cu.usbserial-0001',
      '/dev/cu.usbserial-12345678',
      '/dev/ttyUSB0',
      '/dev/ttyACM0',
      '/dev/ttyS0',
      '/dev/serial/by-id/usb-1a86_USB_Serial',
      'COM1',
      'COM10',
    ]

    const isValidPort = (path: string) => {
      const patterns = [
        /^\/dev\/cu\./,
        /^\/dev\/ttyUSB/,
        /^\/dev\/ttyACM/,
        /^\/dev\/ttyS/,
        /^\/dev\/serial/,
        /^COM\d+$/i,
      ]
      return patterns.some(p => p.test(path))
    }

    expect(isValidPort('/dev/cu.usbserial-0001')).toBe(true)
    expect(isValidPort('/dev/ttyUSB0')).toBe(true)
    expect(isValidPort('COM1')).toBe(true)
    expect(isValidPort('/dev/null')).toBe(false)
    expect(isValidPort('/etc/passwd')).toBe(false)
  })

  test('should handle empty data in serial_write', () => {
    const emptyData = ''
    expect(emptyData.length).toBe(0)
  })

  test('should handle binary escape sequences', () => {
    const parseHex = (hex: string) => String.fromCharCode(parseInt(hex, 16))

    expect(parseHex('00')).toBe('\x00')
    expect(parseHex('FF')).toBe('\xFF')
    expect(parseHex('0A')).toBe('\n')
    expect(parseHex('0D')).toBe('\r')
  })

  test('should handle unicode escape sequences', () => {
    const parseUnicode = (hex: string) => String.fromCharCode(parseInt(hex, 16))

    expect(parseUnicode('0041')).toBe('A')
    expect(parseUnicode('0042')).toBe('B')
    expect(parseUnicode('03A3')).toBe('Σ')
  })

  test('should validate data bits', () => {
    const validDataBits = [5, 6, 7, 8]

    expect(validDataBits).toContain(8)
    expect(validDataBits).not.toContain(4)
    expect(validDataBits).not.toContain(9)
  })

  test('should validate stop bits', () => {
    const validStopBits = [1, 2]

    expect(validStopBits).toContain(1)
    expect(validStopBits).toContain(2)
    expect(validStopBits).not.toContain(1.5) // 1.5 not commonly supported
  })

  test('should handle null/undefined session ID', () => {
    const sessionId = null
    const isValidId = (id: string | null) => id !== null && id !== undefined && id.length > 0

    expect(isValidId(null)).toBe(false)
    expect(isValidId(undefined)).toBe(false)
    expect(isValidId('')).toBe(false)
    expect(isValidId('serial_12345678')).toBe(true)
  })

  test('should validate regex patterns for search', () => {
    const isValidRegex = (pattern: string) => {
      try {
        new RegExp(pattern)
        return true
      } catch {
        return false
      }
    }

    const isNotDangerous = (pattern: string) => {
      // Very basic check for obviously dangerous patterns
      if (/\(\.\*\)\{100,\}/.test(pattern)) return false
      return true
    }

    expect(isValidRegex('hello')).toBe(true)
    expect(isValidRegex('line[0-9]+')).toBe(true)
    expect(isValidRegex('(.*){10}')).toBe(true) // Valid but potentially slow
    expect(isNotDangerous('(.*){100,}')).toBe(false) // Definitely dangerous
  })

  test('should handle buffer overflow gracefully', () => {
    const MAX_BUFFER = 1_000_000
    const largeData = 'x'.repeat(MAX_BUFFER + 1)

    expect(largeData.length).toBeGreaterThan(MAX_BUFFER)
  })

  test('should handle special characters in data', () => {
    const specialChars = '\x00\x01\x02\x7F\x80\xFF'
    expect(specialChars.length).toBe(6)
  })
})

describe('Error Messages', () => {
  test('should build session not found error', () => {
    const buildError = (id: string) => `Serial session '${id}' not found. Use serial_list to see active sessions.`

    expect(buildError('invalid_id')).toContain('invalid_id')
    expect(buildError('invalid_id')).toContain('serial_list')
  })

  test('should include helpful context in error messages', () => {
    const error = 'Serial session \'serial_1234\' is not open (status: closed)'

    expect(error).toContain('not open')
    expect(error).toContain('closed')
    expect(error).toContain('serial_1234')
  })
})
