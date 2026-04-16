import type { Plugin, PluginInput } from '@opencode-ai/plugin'
import { initManager, manager } from './serial/manager'
import { initPermissions } from './serial/permissions'
import { serialList } from './tools/list'
import { serialOpen } from './tools/spawn'
import { serialWrite } from './tools/write'
import { serialRead } from './tools/read'
import { serialClose } from './tools/kill'
import { serialConfig } from './tools/config'
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
  }
}
