import { tool } from '@opencode-ai/plugin'
import { manager } from '../serial/manager'
import { buildSessionNotFoundError, formatLine } from '../serial/utils'
import { DEFAULT_READ_LIMIT, MAX_LINE_LENGTH } from '../shared/constants'
import type { SerialSessionInfo } from '../serial/types'

const DESCRIPTION =
  'Read buffered output from a serial port session, with optional regex filtering.'

function validateRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
  } catch {
    return false
  }
  // Reject patterns with nested quantifiers (ReDoS risk)
  // e.g., (a+)+, (a|a)+, (.*?){3,}, (a+)*, etc.
  if (/\([^)]*?[+*][^)]*\)[+*]/.test(pattern)) return false
  // Reject patterns with adjacent alternations repeated 3+ times
  if (/\(.{1,10}\|[.#]\){3,}/.test(pattern)) return false
  return true
}

function validateAndCreateRegex(pattern: string, ignoreCase?: boolean): RegExp {
  if (!validateRegex(pattern)) {
    throw new Error(`Potentially dangerous regex pattern rejected: '${pattern}'`)
  }
  return new RegExp(pattern, ignoreCase ? 'i' : '')
}

function formatPtyOutput(
  id: string,
  status: string,
  pattern: string | undefined,
  formattedLines: string[],
  hasMore: boolean,
  paginationMessage: string,
  endMessage: string
): string {
  const output = [
    `<serial_output id="${id}" status="${status}"${
      pattern ? ` pattern="${pattern}"` : ''
    }>`,
    ...formattedLines,
    '',
    hasMore ? paginationMessage : endMessage,
    `</serial_output>`,
  ]
  return output.join('\n')
}

function handlePatternRead(
  id: string,
  pattern: string,
  ignoreCase: boolean | undefined,
  session: SerialSessionInfo,
  offset: number,
  limit: number
): string {
  const regex = validateAndCreateRegex(pattern, ignoreCase)
  const result = manager.search(id, regex, offset, limit)
  if (!result) throw buildSessionNotFoundError(id)

  if (result.matches.length === 0) {
    return [
      `<serial_output id="${id}" status="${session.status}" pattern="${pattern}">`,
      `No lines matched '${pattern}'.`,
      `Total lines: ${result.totalLines}`,
      `</serial_output>`,
    ].join('\n')
  }

  const formattedLines = result.matches.map((m) =>
    formatLine(m.text, m.lineNumber, MAX_LINE_LENGTH)
  )
  const paginationMessage = `(${result.matches.length} of ${result.totalMatches} matches shown. offset=${offset + result.matches.length} for more.)`
  const endMessage = `(${result.totalMatches} match(es) from ${result.totalLines} lines)`

  return formatPtyOutput(
    id,
    session.status,
    pattern,
    formattedLines,
    result.hasMore,
    paginationMessage,
    endMessage
  )
}

function handlePlainRead(
  id: string,
  session: SerialSessionInfo,
  offset: number,
  limit: number
): string {
  const result = manager.read(id, offset, limit)
  if (!result) throw buildSessionNotFoundError(id)

  if (result.lines.length === 0) {
    return [
      `<serial_output id="${id}" status="${session.status}">`,
      `(No output available — buffer is empty)`,
      `Total lines: ${result.totalLines}`,
      `</serial_output>`,
    ].join('\n')
  }

  const formattedLines = result.lines.map((line, i) =>
    formatLine(line, result.offset + i + 1, MAX_LINE_LENGTH)
  )
  const paginationMessage = `(Buffer has more. offset=${result.offset + result.lines.length} to read beyond line ${result.offset + result.lines.length})`
  const endMessage = `(End of buffer — total ${result.totalLines} lines)`

  return formatPtyOutput(
    id,
    session.status,
    undefined,
    formattedLines,
    result.hasMore,
    paginationMessage,
    endMessage
  )
}

export const serialRead = tool({
  description: DESCRIPTION,
  args: {
    id: tool.schema
      .string()
      .describe('Session ID (e.g., serial_a1b2c3d4)'),
    offset: tool.schema
      .number()
      .optional()
      .describe('Line number to start from (0-based, default: 0)'),
    limit: tool.schema
      .number()
      .optional()
      .describe(`Number of lines to read (default: ${DEFAULT_READ_LIMIT})`),
    pattern: tool.schema
      .string()
      .optional()
      .describe('Regex pattern to filter lines'),
    ignoreCase: tool.schema
      .boolean()
      .optional()
      .describe('Case-insensitive pattern matching (default: false)'),
  },
  async execute(args, _ctx) {
    const session = manager.get(args.id)
    if (!session) {
      throw buildSessionNotFoundError(args.id)
    }

    const offset = args.offset ?? 0
    const limit = args.limit ?? DEFAULT_READ_LIMIT

    if (args.pattern) {
      return handlePatternRead(
        args.id,
        args.pattern,
        args.ignoreCase,
        session,
        offset,
        limit
      )
    } else {
      return handlePlainRead(args.id, session, offset, limit)
    }
  },
})
