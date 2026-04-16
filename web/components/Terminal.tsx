import React, { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
  onDisconnect: () => void
  onError: (err: string | null) => void
  fontSize?: number
  theme?: 'dark' | 'light'
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000] // Exponential backoff, max 30s

const DARK_THEME = {
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
}

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1f2328',
  cursor: '#0969da',
  cursorAccent: '#ffffff',
  selectionBackground: '#0969da44',
  black: '#484f58',
  red: '#cf222e',
  green: '#1a7f37',
  yellow: '#9a6700',
  blue: '#0969da',
  magenta: '#8250df',
  cyan: '#219aaf',
  white: '#b1bac4',
}

export function Terminal({ sessionId, onDisconnect, onError, fontSize = 14, theme = 'dark' }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const currentTheme = theme === 'dark' ? DARK_THEME : LIGHT_THEME
  const terminalBackground = theme === 'dark' ? '#0d1117' : '#ffffff'

  const initTerminal = useCallback(() => {
    if (!containerRef.current) return

    const xterm = new XTerm({
      theme: currentTheme,
      fontFamily: "Menlo, Monaco, 'Cascadia Code', Consolas, monospace",
      fontSize,
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
  }, [currentTheme, fontSize])

  useEffect(() => {
    const cleanup = initTerminal()
    return cleanup
  }, [initTerminal])

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const connectWebSocket = useCallback(() => {
    if (!sessionId || !xtermRef.current || wsRef.current) return

    const xterm = xtermRef.current
    const attempt = reconnectAttemptRef.current

    if (isReconnecting) {
      xterm.writeln(`\x1b[33mReconnecting (attempt ${attempt + 1})...\x1b[0m`)
    } else {
      xterm.clear()
      xterm.writeln(`\x1b[36mConnecting to session ${sessionId}...\x1b[0m`)
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/serial/${sessionId}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttemptRef.current = 0
      setIsReconnecting(false)
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
      wsRef.current = null
      xterm.writeln(`\x1b[33mConnection closed\x1b[0m`)

      // Attempt to reconnect if not intentionally disconnected
      if (reconnectAttemptRef.current < RECONNECT_DELAYS.length) {
        const delay = RECONNECT_DELAYS[reconnectAttemptRef.current]
        setIsReconnecting(true)
        reconnectAttemptRef.current++
        xterm.writeln(`\x1b[33mReconnecting in ${delay / 1000}s...\x1b[0m`)
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, delay)
      } else {
        xterm.writeln(`\x1b[31mMax reconnection attempts reached. Click reconnect or refresh.\x1b[0m`)
        onDisconnect()
      }
    }

    // Send user input to WebSocket
    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })
  }, [sessionId, isReconnecting, onDisconnect, onError])

  // Connect WebSocket when sessionId changes
  useEffect(() => {
    reconnectAttemptRef.current = 0
    setIsReconnecting(false)
    clearReconnectTimeout()
    connectWebSocket()

    return () => {
      clearReconnectTimeout()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [sessionId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [clearReconnectTimeout])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        background: terminalBackground,
        borderRadius: '8px',
        border: `1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'}`,
        padding: '8px',
        minHeight: 0,
      }}
    />
  )
}
