import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'

export interface HostInfo {
  os: 'macos' | 'linux' | 'windows' | 'unknown'
  osVersion: string
  hasUsbDevices: boolean
  usbDevices: UsbDevice[]
  serialPorts: string[]
  missingDrivers: DriverRecommendation[]
  errors: string[]
}

export interface UsbDevice {
  name: string
  vendorId: string
  productId: string
}

export interface DriverRecommendation {
  name: string
  description: string
  installCommand: string
  url: string
  chipset?: string
}

const DRIVER_RECOMMENDATIONS: Record<string, DriverRecommendation[]> = {
  macos: [
    {
      name: 'CH340/CH341 Driver',
      description: 'For WCH CH340/CH341 USB to serial chips (Arduino Uno, Nano, ESP32-C3, etc.)',
      installCommand: 'brew install ch340g-ch34g-ch34x-macos-x86_64',
      url: 'https://www.wch.cn/downloads/CH341SER_MAC_ZIP.html',
      chipset: 'CH340/CH341',
    },
    {
      name: 'FTDI VCP Driver',
      description: 'For FTDI USB to serial chips (older Arduino, various adapters)',
      installCommand: 'brew install --cask ftdi-vcp-driver',
      url: 'https://www.ftdichip.com/Drivers/VCP.htm',
      chipset: 'FTDI',
    },
    {
      name: 'CP2102 Driver',
      description: 'For Silicon Labs CP2102 USB to UART bridge (ESP8266, various modules)',
      installCommand: 'Manual download required',
      url: 'https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers',
      chipset: 'CP2102',
    },
  ],
  linux: [
    {
      name: 'CH340/CH341 Driver',
      description: 'Usually included in kernel, but may need manual installation',
      installCommand: 'sudo apt install linux-modules-ch34x-extra 2>/dev/null || sudo apt install kmod',
      url: 'https://www.wch.cn/downloads/CH341SER_LINUX_ZIP.html',
      chipset: 'CH340/CH341',
    },
    {
      name: 'FTDI Driver',
      description: 'Usually pre-installed on Linux',
      installCommand: 'sudo modprobe ftdi_sio || echo "Driver may already be loaded"',
      url: 'https://www.ftdichip.com/Drivers/VCP.htm',
      chipset: 'FTDI',
    },
  ],
  windows: [
    {
      name: 'CH340/CH341 Driver',
      description: 'For WCH CH340/CH341 USB to serial chips',
      installCommand: 'Download from URL below and run installer',
      url: 'https://www.wch.cn/downloads/CH341SER_ZIP.html',
      chipset: 'CH340/CH341',
    },
    {
      name: 'FTDI VCP Driver',
      description: 'For FTDI USB to serial chips',
      installCommand: 'Download from URL below and run installer',
      url: 'https://www.ftdichip.com/Drivers/VCP.htm',
      chipset: 'FTDI',
    },
    {
      name: 'CP2102 Driver',
      description: 'For Silicon Labs CP2102 USB to UART bridge',
      installCommand: 'Download from URL below and run installer',
      url: 'https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers',
      chipset: 'CP2102',
    },
  ],
}

/**
 * Safely execute a shell command and return the output or empty string on error.
 */
async function safeShellExec(
  command: TemplateStringsArray,
  ...args: unknown[]
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const result = await $`${command.join(' ')}`.text()
    return { stdout: result, stderr: '', success: true }
  } catch (e: unknown) {
    const error = e as { stderr?: { text: () => string }; message?: string }
    return {
      stdout: '',
      stderr: error?.stderr?.text() || error?.message || 'Unknown error',
      success: false,
    }
  }
}

/**
 * Execute a shell command with fallback value on error.
 */
async function tryExec(
  command: string,
  fallback: string = ''
): Promise<string> {
  try {
    const result = await $`${command}`.text()
    return result.trim()
  } catch {
    return fallback
  }
}

async function detectMacOS(): Promise<Partial<HostInfo>> {
  const errors: string[] = []
  const info: Partial<HostInfo> = { os: 'macos', osVersion: '', errors }

  // Get macOS version
  info.osVersion = await tryExec('sw_vers -productVersion', 'Unknown')

  // Get USB devices
  const usbDevices: UsbDevice[] = []
  try {
    const { stdout, success } = await safeShellExec`system_profiler SPUSBDataType 2>/dev/null`
    if (success && stdout) {
      const lines = stdout.split('\n')
      let currentDevice: Partial<UsbDevice> = {}

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('USB ') && trimmed !== 'USB:') {
          if (currentDevice.name) {
            usbDevices.push(currentDevice as UsbDevice)
          }
          currentDevice = { name: trimmed.replace('USB ', '').replace(':', '') }
        } else if (trimmed.startsWith('Vendor ID:')) {
          currentDevice.vendorId = trimmed.replace('Vendor ID:', '').trim()
        } else if (trimmed.startsWith('Product ID:')) {
          currentDevice.productId = trimmed.replace('Product ID:', '').trim()
        }
      }
      if (currentDevice.name) {
        usbDevices.push(currentDevice as UsbDevice)
      }
    }
  } catch (e) {
    errors.push(`Failed to get USB devices: ${e}`)
  }

  info.usbDevices = usbDevices
  info.hasUsbDevices = usbDevices.length > 0

  // Get serial ports
  try {
    const { stdout, success } = await safeShellExec`ls -1 /dev/cu.* 2>/dev/null`
    if (success && stdout) {
      info.serialPorts = stdout.trim().split('\n').filter(Boolean)
    } else {
      info.serialPorts = []
    }
  } catch (e) {
    info.serialPorts = []
    errors.push(`Failed to list serial ports: ${e}`)
  }

  return info
}

async function detectLinux(): Promise<Partial<HostInfo>> {
  const errors: string[] = []
  const info: Partial<HostInfo> = { os: 'linux', osVersion: '', errors }

  // Get Linux version
  let version = await tryExec('cat /etc/os-release 2>/dev/null | head -1', '')
  if (version) {
    version = version.replace('NAME="', '').replace('"', '').split('\n')[0]
  } else {
    version = await tryExec('uname -r', 'Unknown')
  }
  info.osVersion = version || 'Unknown'

  // Get USB devices
  const usbDevices: UsbDevice[] = []
  try {
    const { stdout, success } = await safeShellExec`lsusb 2>/dev/null`
    if (success && stdout) {
      for (const line of stdout.split('\n')) {
        const match = line.match(/Bus (\d+) Device (\d+): ID ([0-9a-f]{4}):([0-9a-f]{4}) (.+)/)
        if (match) {
          usbDevices.push({
            vendorId: match[3],
            productId: match[4],
            name: match[5]?.trim() || 'Unknown USB Device',
          })
        }
      }
    }
  } catch (e) {
    errors.push(`Failed to get USB devices: ${e}`)
  }

  info.usbDevices = usbDevices
  info.hasUsbDevices = usbDevices.length > 0

  // Get serial ports
  const serialPorts: string[] = []
  const patterns = ['/dev/ttyUSB*', '/dev/ttyACM*', '/dev/ttyS*', '/dev/serial/*']
  for (const pattern of patterns) {
    try {
      const { stdout, success } = await safeShellExec`ls -1 ${pattern} 2>/dev/null`
      if (success && stdout) {
        serialPorts.push(...stdout.trim().split('\n').filter(Boolean))
      }
    } catch {
      // Pattern might not exist, ignore
    }
  }
  info.serialPorts = [...new Set(serialPorts)]

  return info
}

async function detectWindows(): Promise<Partial<HostInfo>> {
  const info: Partial<HostInfo> = {
    os: 'windows',
    osVersion: 'Windows (detection limited)',
    usbDevices: [],
    serialPorts: [],
    errors: ['Windows COM port detection requires PowerShell - manual check recommended'],
  }
  return info
}

export async function getHostInfo(): Promise<HostInfo> {
  const errors: string[] = []
  let info: Partial<HostInfo> = {
    os: 'unknown',
    osVersion: '',
    hasUsbDevices: false,
    usbDevices: [],
    serialPorts: [],
    missingDrivers: [],
    errors,
  }

  // Detect OS and gather info
  try {
    const unameResult = await safeShellExec`uname -s`
    if (unameResult.success) {
      const osType = unameResult.stdout.trim().toLowerCase()

      if (osType === 'darwin') {
        info = { ...info, ...(await detectMacOS()) }
      } else if (osType === 'linux') {
        info = { ...info, ...(await detectLinux()) }
      } else if (osType.includes('mingw') || osType.includes('cygwin') || osType.includes('windows')) {
        info = { ...info, ...(await detectWindows()) }
      } else {
        errors.push(`Unknown OS type: ${osType}`)
      }
    } else {
      errors.push(`Failed to detect OS: ${unameResult.stderr}`)
    }
  } catch (e) {
    errors.push(`OS detection failed: ${e}`)
  }

  // Determine missing drivers
  info.missingDrivers = getMissingDrivers(info)

  return info as HostInfo
}

function getMissingDrivers(info: Partial<HostInfo>): DriverRecommendation[] {
  const os = info.os || 'unknown'

  if (!DRIVER_RECOMMENDATIONS[os]) {
    return []
  }

  const drivers = DRIVER_RECOMMENDATIONS[os] || []

  // If no serial ports, recommend all common drivers
  if (!info.serialPorts || info.serialPorts.length === 0) {
    return drivers
  }

  return []
}

const DESCRIPTION =
  'Get host system information including OS version, USB devices, serial ports, and driver recommendations.'

export const serialHostInfo = tool({
  description: DESCRIPTION,
  args: {},
  async execute() {
    const info = await getHostInfo()

    const lines: string[] = ['<host_info>']
    lines.push(`OS: ${info.os} ${info.osVersion}`)

    // USB devices
    lines.push('')
    lines.push('USB Devices:')
    if (info.usbDevices && info.usbDevices.length > 0) {
      for (const device of info.usbDevices.slice(0, 10)) {
        const vid = device.vendorId || 'N/A'
        const pid = device.productId || 'N/A'
        lines.push(`  - ${device.name} (VID: ${vid}, PID: ${pid})`)
      }
      if (info.usbDevices.length > 10) {
        lines.push(`  ... and ${info.usbDevices.length - 10} more`)
      }
    } else {
      lines.push('  No USB devices detected')
    }

    // Serial ports
    lines.push('')
    lines.push('Serial Ports:')
    if (info.serialPorts && info.serialPorts.length > 0) {
      for (const port of info.serialPorts) {
        lines.push(`  - ${port}`)
      }
    } else {
      lines.push('  No serial ports found')
    }

    // Driver recommendations
    if (info.missingDrivers && info.missingDrivers.length > 0) {
      lines.push('')
      lines.push('Driver Recommendations:')
      for (const driver of info.missingDrivers) {
        lines.push(`  - ${driver.name}`)
        lines.push(`    ${driver.description}`)
        lines.push(`    Install: ${driver.installCommand}`)
        lines.push(`    URL: ${driver.url}`)
        lines.push('')
      }
    }

    // Errors (if any)
    if (info.errors && info.errors.length > 0) {
      lines.push('')
      lines.push('Notes:')
      for (const error of info.errors) {
        lines.push(`  - ${error}`)
      }
    }

    lines.push('</host_info>')
    return lines.join('\n')
  },
})
