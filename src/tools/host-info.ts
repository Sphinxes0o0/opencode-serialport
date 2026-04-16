import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'

export interface HostInfo {
  os: 'macos' | 'linux' | 'windows' | 'unknown'
  osVersion: string
  hasUsbDevices: boolean
  usbDevices: UsbDevice[]
  serialPorts: string[]
  missingDrivers: DriverRecommendation[]
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
      installCommand: 'brew install ft232r-macos-x86_64',
      url: 'https://www.ftdichip.com/Drivers/VCP.htm',
      chipset: 'FTDI',
    },
    {
      name: 'CP2102 Driver',
      description: 'For Silicon Labs CP2102 USB to UART bridge (ESP8266, various modules)',
      installCommand: 'brew install cp2102-macos',
      url: 'https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers',
      chipset: 'CP2102',
    },
  ],
  linux: [
    {
      name: 'CH340/CH341 Driver',
      description: 'Usually included in kernel, but may need manual installation',
      installCommand: 'sudo apt install linux-modules-ch34x',
      url: 'https://www.wch.cn/downloads/CH341SER_LINUX_ZIP.html',
      chipset: 'CH340/CH341',
    },
    {
      name: 'FTDI Driver',
      description: 'Usually pre-installed on Linux',
      installCommand: 'sudo modprobe ftdi_sio',
      url: 'https://www.ftdichip.com/Drivers/VCP.htm',
      chipset: 'FTDI',
    },
  ],
  windows: [
    {
      name: 'CH340/CH341 Driver',
      description: 'For WCH CH340/CH341 USB to serial chips',
      installCommand: 'Download from: https://www.wch.cn/downloads/CH341SER_ZIP.html',
      url: 'https://www.wch.cn/downloads/CH341SER_ZIP.html',
      chipset: 'CH340/CH341',
    },
    {
      name: 'FTDI VCP Driver',
      description: 'For FTDI USB to serial chips',
      installCommand: 'Download from: https://www.ftdichip.com/Drivers/VCP.htm',
      url: 'https://www.ftdichip.com/Drivers/VCP.htm',
      chipset: 'FTDI',
    },
    {
      name: 'CP2102 Driver',
      description: 'For Silicon Labs CP2102 USB to UART bridge',
      installCommand: 'Download from: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers',
      url: 'https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers',
      chipset: 'CP2102',
    },
  ],
}

async function detectMacOS(): Promise<Partial<HostInfo>> {
  const info: Partial<HostInfo> = { os: 'macos', osVersion: '' }

  // Get macOS version
  try {
    const version = await $`sw_vers -productVersion`.text()
    info.osVersion = version.trim()
  } catch {
    info.osVersion = 'Unknown'
  }

  // Get USB devices
  const usbDevices: UsbDevice[] = []
  try {
    const output = await $`system_profiler SPUSBDataType 2>/dev/null`.text()
    const lines = output.split('\n')
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
  } catch {
    // Ignore
  }

  info.usbDevices = usbDevices
  info.hasUsbDevices = usbDevices.length > 0

  // Get serial ports
  try {
    const ports = await $`ls -1 /dev/cu.* 2>/dev/null`.text()
    info.serialPorts = ports.trim().split('\n').filter(Boolean)
  } catch {
    info.serialPorts = []
  }

  return info
}

async function detectLinux(): Promise<Partial<HostInfo>> {
  const info: Partial<HostInfo> = { os: 'linux', osVersion: '' }

  // Get Linux version
  try {
    const version = await $`cat /etc/os-release 2>/dev/null | head -1`.text()
    info.osVersion = version.trim().replace('NAME="', '').replace('"', '')
  } catch {
    try {
      const version = await $`uname -r`.text()
      info.osVersion = version.trim()
    } catch {
      info.osVersion = 'Unknown'
    }
  }

  // Get USB devices
  const usbDevices: UsbDevice[] = []
  try {
    const output = await $`lsusb 2>/dev/null`.text()
    for (const line of output.split('\n')) {
      const match = line.match(/Bus (\d+) Device (\d+): ID ([0-9a-f]{4}):([0-9a-f]{4}) (.+)/)
      if (match) {
        usbDevices.push({
          vendorId: match[3],
          productId: match[4],
          name: match[5] || 'Unknown USB Device',
        })
      }
    }
  } catch {
    // Ignore
  }

  info.usbDevices = usbDevices
  info.hasUsbDevices = usbDevices.length > 0

  // Get serial ports
  const serialPorts: string[] = []
  try {
    const patterns = ['/dev/ttyUSB*', '/dev/ttyACM*', '/dev/ttyS*', '/dev/serial/*']
    for (const pattern of patterns) {
      const output = await $`ls -1 ${pattern} 2>/dev/null`.text()
      serialPorts.push(...output.trim().split('\n').filter(Boolean))
    }
  } catch {
    // Ignore
  }
  info.serialPorts = [...new Set(serialPorts)]

  return info
}

async function detectWindows(): Promise<Partial<HostInfo>> {
  const info: Partial<HostInfo> = {
    os: 'windows',
    osVersion: 'Unknown',
    usbDevices: [],
    serialPorts: [],
    hasUsbDevices: false,
  }
  // Windows detection would require PowerShell or WMI
  // For now, return basic info
  return info
}

export async function getHostInfo(): Promise<HostInfo> {
  let info: Partial<HostInfo> = {
    os: 'unknown',
    osVersion: '',
    hasUsbDevices: false,
    usbDevices: [],
    serialPorts: [],
    missingDrivers: [],
  }

  // Detect OS and gather info
  try {
    const uname = await $`uname -s`.text()
    const osType = uname.trim().toLowerCase()

    if (osType === 'darwin') {
      info = { ...info, ...(await detectMacOS()) }
    } else if (osType === 'linux') {
      info = { ...info, ...(await detectLinux()) }
    } else if (osType.includes('mingw') || osType.includes('cygwin') || osType.includes('windows')) {
      info = { ...info, ...(await detectWindows()) }
    }
  } catch {
    // Fallback
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

  // Could be enhanced to check specific USB VID/PID against known chip types
  return drivers
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
        lines.push(`  - ${device.name} (VID: ${device.vendorId}, PID: ${device.productId})`)
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

    lines.push('</host_info>')
    return lines.join('\n')
  },
})
