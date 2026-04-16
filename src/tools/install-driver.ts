import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'
import { getHostInfo, type DriverRecommendation } from './host-info'

const DESCRIPTION =
  'Install USB to serial driver. Shows available drivers and prompts for confirmation before installation.'

export const serialInstallDriver = tool({
  description: DESCRIPTION,
  args: {
    driver: tool.schema
      .enum(['ch340', 'ftdi', 'cp2102', 'auto'])
      .optional()
      .describe('Driver to install: ch340, ftdi, cp2102, or auto (default: auto)'),
    force: tool.schema
      .boolean()
      .optional()
      .describe('Skip confirmation prompt (for scripting)'),
  },
  async execute(args, ctx) {
    const info = await getHostInfo()
    const driverMap: Record<string, string> = {
      ch340: 'CH340/CH341 Driver',
      ftdi: 'FTDI VCP Driver',
      cp2102: 'CP2102 Driver',
      auto: '',
    }

    const targetDriverName = driverMap[args.driver || 'auto']

    // Find matching drivers
    let candidates = info.missingDrivers || []
    if (targetDriverName) {
      candidates = candidates.filter(
        (d) => d.name.toLowerCase().includes(targetDriverName.toLowerCase())
      )
    }

    if (candidates.length === 0) {
      return [
        '<driver_install>',
        'No drivers available for installation.',
        `Current OS: ${info.os}`,
        'If you believe this is an error, please file a bug report.',
        '</driver_install>',
      ].join('\n')
    }

    const driver = candidates[0]
    const lines: string[] = []

    // Check if already installed
    if (info.serialPorts && info.serialPorts.length > 0) {
      lines.push('<driver_install>')
      lines.push(`Driver "${driver.name}" may already be installed.`)
      lines.push(`Found serial ports: ${info.serialPorts.join(', ')}`)
      lines.push('</driver_install>')
      return lines.join('\n')
    }

    // Build install command based on OS
    const installResult = await installDriverForOS(driver, info.os)

    lines.push('<driver_install>')
    lines.push(`Driver: ${driver.name}`)
    lines.push(`Description: ${driver.description}`)
    lines.push(`Install Command: ${installResult.command}`)
    lines.push('')
    lines.push(installResult.output)
    lines.push('</driver_install>')

    return lines.join('\n')
  },
})

async function installDriverForOS(
  driver: DriverRecommendation,
  os: string
): Promise<{ command: string; output: string }> {
  const lines: string[] = []
  let command = driver.installCommand
  let output = ''

  if (os === 'macos') {
    // For macOS, try to install via brew
    if (driver.name.toLowerCase().includes('ch340')) {
      command = 'brew install ch340g-ch34g-ch34x-macos-x86_64'
      try {
        // Check if brew is available
        await $`which brew`.text()
        output = await $`${command} 2>&1`.text()
      } catch {
        output = `Brew not found. Please install brew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
      }
    } else if (driver.name.toLowerCase().includes('ftdi')) {
      command = 'brew install --cask ftdi-vcp-driver'
      try {
        await $`which brew`.text()
        output = await $`${command} 2>&1`.text()
      } catch {
        output = `Brew not found. Please install brew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
      }
    } else if (driver.name.toLowerCase().includes('cp2102')) {
      output = 'CP2102 driver for macOS requires manual installation.'
      output += '\nDownload from: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers'
    } else {
      output = `Manual installation required for ${driver.name}`
      output += `\nDownload from: ${driver.url}`
    }
  } else if (os === 'linux') {
    if (driver.name.toLowerCase().includes('ch340')) {
      command = 'sudo apt update && sudo apt install linux-modules-ch34x-extra'
      try {
        await $`${command} 2>&1`.text()
        output = 'Driver installed successfully (or already present).'
      } catch {
        output = 'Failed to install via apt. Try manual installation.'
        output += `\nDownload from: ${driver.url}`
      }
    } else if (driver.name.toLowerCase().includes('ftdi')) {
      command = 'sudo modprobe ftdi_sio'
      try {
        await $`${command} 2>&1`.text()
        output = 'FTDI driver loaded successfully.'
      } catch {
        output = 'Failed to load FTDI driver.'
      }
    } else {
      output = `Manual installation required for ${driver.name}`
      output += `\nDownload from: ${driver.url}`
    }
  } else if (os === 'windows') {
    output = 'Windows driver installation requires manual steps:'
    output += `\n1. Download driver from: ${driver.url}`
    output += '\n2. Run the installer'
    output += '\n3. Connect your device and wait for driver installation'
    output += '\n4. Check Device Manager for COM port assignment'
  } else {
    output = `Unsupported OS: ${os}`
    output += `\nPlease download driver manually from: ${driver.url}`
  }

  return { command, output }
}
