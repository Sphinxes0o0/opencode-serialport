# opencode-serialport

OpenCode plugin for serial port communication with a Web UI.

## Features

- List available serial ports (macOS `/dev/cu.*`, Linux `/dev/ttyUSB*` `/dev/ttyACM*`)
- Open serial ports with configurable baud rate, data bits, parity, and stop bits
- Bidirectional communication via tool interface or Web UI
- Real-time terminal in browser using xterm.js
- Permission-based access control via `opencode.json`

## Installation

### Local development

```bash
cd ~/.config/opencode/plugins/
git clone https://github.com/YOUR_USERNAME/opencode-serialport.git
cd opencode-serialport
bun install
```

### npm package

Add to `opencode.json`:

```json
{
  "plugin": ["opencode-serialport"]
}
```

## Tools

### serial_list

List all available serial ports on the system.

```typescript
// Tool: serial_list
// Arguments: {}
const ports = await serial_list()
```

### serial_open

Open a serial port and create a session.

```typescript
// Tool: serial_open
// Arguments:
{
  port: "/dev/cu.usbserial-0001",  // required
  baudrate?: 115200,                  // default: 115200
  databits?: 8,                      // default: 8
  parity?: "none" | "even" | "odd", // default: "none"
  stopbits?: 1 | 2,                 // default: 1
  flowControl?: "none",              // default: "none" (hardware/software not yet supported)
  title?: "My Arduino",
  description?: "Arduino UNO debug",
  notifyOnDisconnect?: false,
}
const result = await serial_open({ port: "/dev/cu.usbserial-0001", baudrate: 9600 })
// Returns: <serial_opened> ID: serial_a1b2c3d4 ...
```

### serial_write

Send data to the serial port. Escape sequences (`\n`, `\r`, `\t`, `\xNN`) are decoded by default.

```typescript
// Tool: serial_write
// Arguments:
{
  id: "serial_a1b2c3d4",  // required
  data: "AT\r\n",          // required
  raw?: false,             // default: false (parse escape sequences)
}
await serial_write({ id: "serial_a1b2c3d4", data: "AT\r\n" })
```

### serial_read

Read buffered output from the serial port.

```typescript
// Tool: serial_read
// Arguments:
{
  id: "serial_a1b2c3d4",    // required
  offset?: 0,               // default: 0
  limit?: 500,             // default: 500
  pattern?: "OK|ERROR",    // regex filter
  ignoreCase?: false,
}
const output = await serial_read({ id: "serial_a1b2c3d4", pattern: "OK" })
```

### serial_close

Close an open serial connection.

```typescript
// Tool: serial_close
// Arguments:
{
  id: "serial_a1b2c3d4",  // required
  cleanup?: false,         // default: false (keep buffer)
}
```

### serial_config

Query current session configuration.

```typescript
// Tool: serial_config
// Arguments:
{
  id: "serial_a1b2c3d4",    // required
  baudrate?: 9600,          // (informational — requires reopen to take effect)
}
```

## Web UI

Open the Web UI in your browser:

```
serial-open-browser
```

Or get the URL:

```
serial-show-url
```

The Web UI provides a terminal-style interface powered by xterm.js for real-time bidirectional communication.

## Permissions

Configure in `opencode.json`:

```json
{
  "permission": {
    "serial": {
      "/dev/cu.usbserial-0001": "allow",
      "/dev/cu.*": "deny"
    }
  }
}
```

## Building

```bash
# Install dependencies
bun install

# Build web UI (required for Web UI)
bun run build

# TypeScript check
bun run typecheck
```

## Architecture

```
src/
├── plugin.ts              # Plugin entry point
├── serial/
│   ├── types.ts          # Type definitions
│   ├── buffer.ts         # RingBuffer for serial data
│   ├── session-lifecycle.ts  # Serial port open/close lifecycle
│   ├── manager.ts         # SerialManager aggregation
│   ├── output-manager.ts # Read/search operations
│   ├── permissions.ts    # Port access control
│   └── utils.ts          # Utilities
├── tools/
│   ├── list.ts           # serial_list
│   ├── spawn.ts          # serial_open
│   ├── write.ts          # serial_write
│   ├── read.ts           # serial_read
│   ├── kill.ts           # serial_close
│   └── config.ts         # serial_config
└── web/
    └── server/
        └── server.ts     # Bun WebSocket + HTTP server

web/
├── App.tsx               # React app
├── main.tsx             # Entry point
├── index.html           # HTML shell
└── components/
    └── Terminal.tsx     # xterm.js terminal component
```

## Platform Support

- **macOS**: `/dev/cu.*` ports
- **Linux**: `/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/ttyS*`, `/dev/serial/*`

Uses `stty` for serial port configuration — available by default on macOS and Linux.

## License

MIT
