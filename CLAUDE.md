# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

opencode-serialport is an OpenCode plugin that provides serial port communication with a Web UI. It exposes tools for listing, opening, reading from, writing to, and closing serial ports.

## Build Commands

```bash
bun install          # Install dependencies
bun run build       # Build web UI (required before Web UI works)
bun run typecheck   # TypeScript check
bun run test        # Run tests
bun run dev         # Watch mode for web build
```

## Architecture

The plugin uses a layered architecture:

- **plugin.ts** — Plugin entry point, registers all tools and commands
- **serial/** — Core serial port logic:
  - `session-lifecycle.ts` — Opens/closes serial ports via `stty`, manages file descriptors, runs the read loop
  - `manager.ts` — SerialManager aggregates lifecycle + output management, provides broadcast callback for WebSocket
  - `output-manager.ts` — RingBuffer reads and search operations
  - `buffer.ts` — RingBuffer implementation for serial data
  - `permissions.ts` — Port access control via `opencode.json`
- **tools/** — One file per tool (e.g., `spawn.ts` = serial_open, `read.ts` = serial_read)
- **web/server/server.ts** — Bun WebSocket + HTTP server for the Web UI
- **web/** — React frontend with xterm.js terminal

## Serial Port Configuration

Serial ports are configured using `stty` commands built in `session-lifecycle.ts::buildSttyCommand`. Key points:
- Baud rate, data bits, parity, stop bits are all set via stty
- Raw mode is applied last after all other settings
- Ports use synchronous `readSync`/`writeSync` on file descriptors

## Platform Notes

- **macOS**: Uses `/dev/cu.*` ports
- **Linux**: Uses `/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/ttyS*`, `/dev/serial/*`
- Hardware/software flow control is declared in types but not yet implemented in stty command
