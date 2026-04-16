import React, { useState, useEffect, useCallback } from 'react'
import { Terminal } from './components/Terminal'

interface SessionInfo {
  id: string
  title: string
  port: string
  baudrate: number
  status: string
}

function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parse session ID from URL path: /serial/:id
  const getSessionIdFromPath = useCallback((): string | null => {
    const match = window.location.pathname.match(/^\/serial\/(.+)$/)
    return match ? match[1] : null
  }, [])

  // Fetch sessions from the API
  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch {
      // Silently fail - server might not be running
    }
  }, [])

  // Initial session fetch and polling
  useEffect(() => {
    fetchSessions()
    // Poll for session updates every 2 seconds
    const interval = setInterval(fetchSessions, 2000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  useEffect(() => {
    const sessionId = getSessionIdFromPath()
    if (sessionId) {
      setSelectedSession(sessionId)
    }
  }, [getSessionIdFromPath])

  const handleConnect = useCallback(
    async (sessionId: string) => {
      setConnecting(true)
      setError(null)
      setSelectedSession(sessionId)
      // Update URL without reload
      window.history.pushState({}, '', `/serial/${sessionId}`)
      setConnecting(false)
    },
    []
  )

  const handleDisconnect = useCallback(() => {
    setSelectedSession(null)
    window.history.pushState({}, '', '/')
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '16px', gap: '16px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#61dafb' }}>
          Serial Monitor
        </h1>
        <span style={{ fontSize: '12px', color: '#7d8590', background: '#21262d', padding: '2px 8px', borderRadius: '12px' }}>
          {sessions.length} session(s)
        </span>
      </header>

      {error && (
        <div style={{ background: '#f8514966', border: '1px solid #f85149', borderRadius: '6px', padding: '12px', color: '#f85149' }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', gap: '16px', minHeight: 0 }}>
        {/* Session List Sidebar */}
        <aside style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: '#7d8590', marginBottom: '4px' }}>ACTIVE SESSIONS</div>
          {sessions.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#484f58', fontStyle: 'italic' }}>
              No active sessions. Use serial_open in opencode to create one.
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleConnect(s.id)}
                style={{
                  background: selectedSession === s.id ? '#21262d' : 'transparent',
                  border: '1px solid',
                  borderColor: selectedSession === s.id ? '#58a6ff' : '#30363d',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#e6edf3',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.title}</div>
                <div style={{ fontSize: '11px', color: '#7d8590', marginTop: '2px' }}>
                  {s.port} @ {s.baudrate} baud
                </div>
                <div style={{ fontSize: '11px', color: s.status === 'open' ? '#3fb950' : '#7d8590', marginTop: '2px' }}>
                  {s.status}
                </div>
              </button>
            ))
          )}
        </aside>

        {/* Terminal Area */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {selectedSession ? (
            <Terminal
              sessionId={selectedSession}
              onDisconnect={handleDisconnect}
              onError={setError}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#161b22', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ textAlign: 'center', color: '#484f58' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📡</div>
                <div>Select a session from the sidebar</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>or use serial_open in opencode</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
