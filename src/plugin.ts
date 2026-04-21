import type { Plugin, PluginInput } from '@opencode-ai/plugin'
import { initManager, manager } from './serial/manager'
import { initPermissions } from './serial/permissions'
import { serialList } from './tools/list'
import { serialOpen } from './tools/spawn'
import { serialWrite } from './tools/write'
import { serialRead } from './tools/read'
import { serialClose } from './tools/kill'
import { serialConfig } from './tools/config'
import { serialClear } from './tools/clear'
import { serialHostInfo } from './tools/host-info'
import { serialInstallDriver } from './tools/install-driver'
import { getOrCreateWebServer } from './web/server/server'
import { $ } from 'bun'

const serialOpenBrowserCommand = 'serial-open-browser'
const serialShowUrlCommand = 'serial-show-url'

export const SerialPlugin: Plugin = async ({
  client,
  directory,
}: PluginInput) => {
  initPermissions(client as any, directory)
  initManager(client as any)

  return {
    'command.execute.before': async (input) => {
      if (
        input.command !== serialOpenBrowserCommand &&
        input.command !== serialShowUrlCommand
      ) {
        return
      }

      const server = await getOrCreateWebServer()

      if (input.command === serialOpenBrowserCommand) {
        await $`open ${server.url.origin}`
      } else if (input.command === serialShowUrlCommand) {
        const message = `Serial Sessions Web UI: ${server.url.origin}`
        await client.session.prompt({
          path: { id: input.sessionID },
          body: {
            noReply: true,
            parts: [{ type: 'text', text: message }],
          },
        })
      }
      throw new Error('Command handled by Serial plugin')
    },
    tool: {
      serial_list: serialList,
      serial_open: serialOpen,
      serial_write: serialWrite,
      serial_read: serialRead,
      serial_close: serialClose,
      serial_config: serialConfig,
      serial_clear: serialClear,
      serial_host_info: serialHostInfo,
      serial_install_driver: serialInstallDriver,
    },
    config: async (input) => {
      if (!input.command) input.command = {}
      input.command[serialOpenBrowserCommand] = {
        template:
          'This command will open the Serial Sessions Web Interface in your default browser.',
        description: 'Open Serial Web Interface',
      }
      input.command[serialShowUrlCommand] = {
        template:
          'This command will show the Serial Sessions Web Interface URL in the chat.',
        description: 'Show Serial Web Interface URL',
      }
    },
    event: async ({ event }) => {
      if (event.type === 'session.deleted') {
        const id = (event as any).properties?.info?.id
        if (id) {
          manager.cleanupBySession(id)
        }
      }
    },
    'permission.ask': async (input, output) => {
      if (input.type !== 'serial') return
      // Check permission config for this port pattern
      const portPattern = typeof input.pattern === 'string'
        ? input.pattern
        : Array.isArray(input.pattern) ? input.pattern[0] : ''
      if (!portPattern) return
      try {
        const response = await client.config.get()
        if (response.error || !response.data) return
        const config = response.data as any
        const serialPerms = config?.permission?.serial
        if (!serialPerms) return
        for (const [pattern, action] of Object.entries(serialPerms)) {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
          if (regex.test(portPattern)) {
            if (action === 'allow') {
              output.status = 'allow'
            } else if (action === 'deny') {
              output.status = 'deny'
            } else {
              output.status = 'deny' // ask not supported, default to deny
            }
            return
          }
        }
      } catch {
        // On error, deny by default
        output.status = 'deny'
      }
    },
  }
}
