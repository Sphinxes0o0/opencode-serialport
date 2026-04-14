import React, { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
  onDisconnect: () => void
  onError: (err: string | null) => void
}

export function Terminal({ sessionId, onDisconnect, onError }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const initTerminal = useCallback(() => {
    if (!containerRef.current) return

    const xterm = new XTerm({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#58a6ff44',
        black: '#484f58',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
      },
      fontFamily: "Menlo, Monaco, 'Cascadia Code', Consolas, monospace",
      fontSize: 14,
      cursorBlink: true,
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(containerRef.current)
    fitAddon.fit()

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Handle resize
    const observer = new ResizeObserver(() => {
      fitAddon.fit()
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      xterm.dispose()
    }
  }, [])

  useEffect(() => {
    const cleanup = initTerminal()
    return cleanup
  }, [initTerminal])

  // Connect WebSocket when sessionId changes
  useEffect(() => {
    if (!sessionId || !xtermRef.current) return

    const xterm = xtermRef.current
    xterm.clear()
    xterm.writeln(`\x1b[36mConnecting to session ${sessionId}...\x1b[0m`)

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/serial/${sessionId}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      xterm.writeln(`\x1b[32mConnected\x1b[0m`)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'connected') {
          xterm.writeln(`\x1b[32mSession: ${msg.session.title}\x1b[0m`)
          xterm.writeln(`Port: ${msg.session.port} @ ${msg.session.baudrate} baud`)
          xterm.writeln(`Status: ${msg.session.status}`)
          xterm.writeln('')
        } else if (msg.type === 'data') {
          xterm.write(msg.text)
        } else if (msg.type === 'error') {
          xterm.writeln(`\x1b[31mError: ${msg.message}\x1b[0m`)
        }
      } catch {
        // Raw text data
        xterm.write(event.data as string)
      }
    }

    ws.onerror = () => {
      xterm.writeln(`\x1b[31mWebSocket error\x1b[0m`)
      onError('WebSocket connection error')
    }

    ws.onclose = () => {
      xterm.writeln(`\x1b[33mDisconnected\x1b[0m`)
      onDisconnect()
    }

    // Send user input to WebSocket
    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [sessionId, onDisconnect, onError])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        background: '#0d1117',
        borderRadius: '8px',
        border: '1px solid #30363d',
        padding: '8px',
        minHeight: 0,
      }}
    />
  )
}
