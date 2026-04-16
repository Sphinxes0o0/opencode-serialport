import React from 'react'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  theme: 'dark' | 'light'
  onThemeChange: (theme: 'dark' | 'light') => void
}

export function Settings({ isOpen, onClose, fontSize, onFontSizeChange, theme, onThemeChange }: SettingsProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '300px',
        background: theme === 'dark' ? '#161b22' : '#ffffff',
        borderLeft: `1px solid ${theme === 'dark' ? '#30363d' : '#d0d7de'}`,
        padding: '20px',
        zIndex: 1000,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: theme === 'dark' ? '#e6edf3' : '#1f2328' }}>
          Settings
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme === 'dark' ? '#7d8590' : '#656d76',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Theme Setting */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: theme === 'dark' ? '#7d8590' : '#656d76', marginBottom: '8px', display: 'block' }}>
          THEME
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onThemeChange('dark')}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: theme === 'dark' ? '#21262d' : 'transparent',
              border: `1px solid ${theme === 'dark' ? '#58a6ff' : '#d0d7de'}`,
              borderRadius: '6px',
              color: theme === 'dark' ? '#e6edf3' : '#1f2328',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            🌙 Dark
          </button>
          <button
            onClick={() => onThemeChange('light')}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: theme === 'light' ? '#21262d' : 'transparent',
              border: `1px solid ${theme === 'light' ? '#58a6ff' : '#d0d7de'}`,
              borderRadius: '6px',
              color: theme === 'light' ? '#e6edf3' : '#1f2328',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            ☀️ Light
          </button>
        </div>
      </div>

      {/* Font Size Setting */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: theme === 'dark' ? '#7d8590' : '#656d76', marginBottom: '8px', display: 'block' }}>
          FONT SIZE: {fontSize}px
        </label>
        <input
          type="range"
          min="10"
          max="24"
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
          style={{
            width: '100%',
            cursor: 'pointer',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: theme === 'dark' ? '#7d8590' : '#656d76', marginTop: '4px' }}>
          <span>10px</span>
          <span>24px</span>
        </div>
      </div>

      {/* Connection Status */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: theme === 'dark' ? '#7d8590' : '#656d76', marginBottom: '8px', display: 'block' }}>
          ABOUT
        </label>
        <div style={{ fontSize: '13px', color: theme === 'dark' ? '#e6edf3' : '#1f2328' }}>
          <p>Serial Monitor v0.1.0</p>
          <p style={{ marginTop: '8px', fontSize: '12px', color: theme === 'dark' ? '#7d8590' : '#656d76' }}>
            OpenCode plugin for serial port communication
          </p>
        </div>
      </div>
    </div>
  )
}
