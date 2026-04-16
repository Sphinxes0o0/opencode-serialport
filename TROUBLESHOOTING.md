# Troubleshooting Guide

## Common Issues

### No Serial Ports Found

**Symptoms:**
- `serial_list` returns "No serial ports found"
- Device is connected but not appearing

**Solutions:**

1. **Check USB connection**
   ```bash
   # macOS
   system_profiler SPUSBDataType

   # Linux
   lsusb
   dmesg | grep tty
   ```

2. **Install USB-Serial Driver**
   ```bash
   # Check host info for recommendations
   serial_host_info

   # Install recommended driver
   serial_install_driver driver=ch340
   ```

3. **Check permissions**
   ```bash
   # macOS (no special permissions needed for /dev/cu.*)
   ls -la /dev/cu.*

   # Linux
   ls -la /dev/ttyUSB*
   sudo usermod -a -G dialout $USER
   ```

---

### Permission Denied Error

**Symptoms:**
- Error: "Port is denied by configuration"
- Cannot open serial port

**Solutions:**

1. **Check opencode.json permissions**
   ```json
   {
     "permission": {
       "serial": {
         "/dev/cu.usbserial-0001": "allow"
       }
     }
   }
   ```

2. **Allow specific port pattern**
   ```json
   {
     "permission": {
       "serial": {
         "/dev/cu.*": "allow"
       }
     }
   }
   ```

---

### Web UI Not Loading

**Symptoms:**
- `serial-open-browser` doesn't open browser
- `serial-show-url` returns error

**Solutions:**

1. **Build web UI**
   ```bash
   bun run build
   ```

2. **Check server is running**
   - The web server starts when first connecting via opencode
   - Try restarting opencode

3. **Check hostname configuration**
   ```bash
   export SERIAL_WEB_HOSTNAME=localhost
   ```

---

### Connection Drops / Disconnects

**Symptoms:**
- Serial connection closes unexpectedly
- WebSocket reconnection attempts

**Solutions:**

1. **Device may have disconnected** - Check physical USB connection

2. **Check cable quality** - Some cheap USB cables don't support data

3. **Try lower baud rate**
   ```
   serial_open port=/dev/cu.usbserial baudrate=9600
   ```

---

### Garbled Output / Wrong Characters

**Symptoms:**
- Output shows strange characters instead of text
- Data appears corrupted

**Solutions:**

1. **Match baud rate**
   ```
   # Check device documentation for correct baud rate
   serial_open port=/dev/cu.usbserial baudrate=115200
   ```

2. **Check serial settings**
   ```
   serial_config id=<session_id>
   ```

3. **Common baud rates:**
   - 9600 - Most devices
   - 115200 - Arduino default
   - 460800 - ESP32 default

---

### Write Operation Fails

**Symptoms:**
- `serial_write` returns error
- Data not reaching device

**Solutions:**

1. **Check session is open**
   ```
   serial_config id=<session_id>
   ```

2. **Check session status** - Session may have been closed

3. **Try shorter data** - Large writes may timeout

---

## Platform-Specific Issues

### macOS

**CH340 Driver Installation:**
```bash
brew install ch340g-ch34g-ch34x-macos-x86_64
```

**After installation, you may need to:**
1. Unplug and replug the device
2. Or restart your computer

**FTDI Driver:**
```bash
brew install --cask ftdi-vcp-driver
```

### Linux

**Check if driver is loaded:**
```bash
lsmod | grep ch341
lsmod | grep ftdi_sio
```

**Manually load driver:**
```bash
sudo modprobe ch341
sudo modprobe ftdi_sio
```

**Check device permissions:**
```bash
ls -la /dev/ttyUSB*
sudo usermod -a -G dialout $USER
# Then log out and back in
```

### Windows

**Install drivers manually:**
1. Download driver from manufacturer website
2. Connect device
3. Windows Update should find driver automatically

**Check COM port:**
1. Open Device Manager
2. Look under "Ports (COM & LPT)"
3. Note the COM number

---

## Debug Mode

### Enable Verbose Logging

Check the console output in opencode for detailed error messages.

### Test Serial Connection

Using `screen` (macOS/Linux):
```bash
screen /dev/cu.usbserial-0001 115200
# Type some AT commands
# Press Ctrl+A then \ to quit
```

Using `minicom` (Linux):
```bash
minicom -D /dev/ttyUSB0 -b 115200
```

---

## Getting Help

If issues persist:

1. **Check opencode logs** for detailed error messages
2. **Run diagnostics**:
   ```bash
   serial_host_info
   serial_list
   ```
3. **Verify hardware** - Test device on another computer

---

## Error Reference

| Error Code | Description | Solution |
|------------|------------|----------|
| `PORT_DENIED` | Port blocked by permissions | Update `opencode.json` |
| `SESSION_NOT_FOUND` | Invalid session ID | Use `serial_list` to find valid ID |
| `PORT_NOT_OPEN` | Session closed | Reopen with `serial_open` |
| `DRIVER_MISSING` | USB driver not installed | Run `serial_install_driver` |
