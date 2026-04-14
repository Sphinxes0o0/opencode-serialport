import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'

const DESCRIPTION =
  'List available serial ports on the system. Scans /dev/cu.* (macOS) and /dev/serial/*, /dev/tty.* (Linux).'

export const serialList = tool({
  description: DESCRIPTION,
  args: {},
  async execute() {
    const lines: string[] = ['<serial_ports>']

    // macOS serial ports
    const macPorts = await $`ls -1 /dev/cu.* 2>/dev/null`.text().catch(() => '')
    const macList = macPorts.trim().split('\n').filter(Boolean)
    // Linux serial ports
    const linuxPorts = await $`ls -1 /dev/serial/* /dev/ttyUSB* /dev/ttyACM* /dev/ttyS* 2>/dev/null`.text().catch(() => '')
    const linuxList = linuxPorts.trim().split('\n').filter(Boolean)

    const allPorts = [...macList, ...linuxList]

    if (allPorts.length === 0) {
      lines.push('No serial ports found.')
    } else {
      lines.push(`Found ${allPorts.length} port(s):`)
      for (const port of allPorts) {
        lines.push(`  ${port}`)
      }
    }

    lines.push('</serial_ports>')
    return lines.join('\n')
  },
})
