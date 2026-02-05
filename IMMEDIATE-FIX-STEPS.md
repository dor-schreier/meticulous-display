# Immediate Fix Steps for Your Pi

## Current Issue

X server cannot start because:
1. **Socket file exists**: `/tmp/.X11-unix/X0` (even after removal attempts)
2. **Process holding TTY7**: PID 596 is holding `/dev/tty7`
3. **User mismatch**: Commands are being run as root, but X needs to run as user `met`

## Quick Fix (Run on Pi)

### Option 1: Force Fix Script (Recommended)

```bash
cd ~/meticulous-display
git pull
sudo bash scripts/force-fix-xserver.sh
```

This will:
- Kill all X processes forcefully
- Kill whatever is holding /dev/tty7
- Remove socket files with extreme prejudice
- Test X manually before letting systemd handle it
- Verify everything works

### Option 2: Manual Nuclear Option

If the script doesn't work, do this manually:

```bash
# 1. Stop everything
sudo systemctl stop meticulous-kiosk
sudo systemctl stop xserver
sudo systemctl stop getty@tty7  # This might be holding tty7

# 2. Kill EVERYTHING
sudo pkill -9 X
sudo pkill -9 Xorg
sudo pkill -9 chromium
sudo pkill -9 getty

# 3. Kill whatever is on tty7
sudo fuser -k /dev/tty7

# 4. Nuclear socket cleanup
sudo rm -rf /tmp/.X11-unix
sudo mkdir -p /tmp/.X11-unix
sudo chmod 1777 /tmp/.X11-unix
sudo rm -f /tmp/.X0-lock

# 5. Verify clean
ls -la /tmp/.X11-unix/
# Should be empty

# 6. Fix permissions
sudo rm -f ~/.Xauthority
touch ~/.Xauthority
chmod 600 ~/.Xauthority

# 7. Try starting X manually
/usr/bin/X :0 -nolisten tcp vt7 &
sleep 3

# 8. Test it
DISPLAY=:0 xset q
# Should work now

# 9. Kill manual X
killall X

# 10. Let systemd take over
sudo systemctl start xserver
sleep 3
sudo systemctl status xserver
```

### Option 3: Reboot (If All Else Fails)

Sometimes a reboot clears stuck resources:

```bash
# First, disable xserver temporarily
sudo systemctl disable xserver

# Reboot
sudo reboot

# After reboot, log back in and run fix
cd ~/meticulous-display
sudo bash scripts/force-fix-xserver.sh

# Re-enable and start
sudo systemctl enable xserver
sudo systemctl start xserver
```

## Understanding the Problem

### The Socket Issue

X server uses a Unix socket at `/tmp/.X11-unix/X0`. When X crashes, this socket can remain, preventing new X instances from starting.

**The error message:**
```
Cannot establish any listening sockets - Make sure an X server isn't already running
```

This is X seeing the socket and thinking another X is running.

### The TTY7 Issue

From the diagnostic:
```bash
/dev/tty7:             596
```

Process 596 is holding the TTY. This could be:
- Old getty service
- Crashed X server
- Another display manager

We need to kill it before X can use tty7.

### The User Issue

X must run as your user (`met`), not as `root`. When you run commands with `sudo`, you become root temporarily. Make sure:

```bash
# Check your user
whoami  # Should show: met

# Check in sudo
sudo whoami  # Shows: root (but that's okay for the fix script)
```

## After Fix Verification

Once you run the fix, verify with:

```bash
# 1. Check X server is stable
systemctl status xserver
# Should show: "active (running)"
# Restart count should be 0 or very low

# 2. Check no processes on tty7
sudo fuser /dev/tty7
# Should show only X process

# 3. Test X connection
DISPLAY=:0 xset q
# Should show server information

# 4. Check socket
ls -la /tmp/.X11-unix/
# Should show X0 owned by your user

# 5. Start kiosk
sudo systemctl start meticulous-kiosk

# 6. Check kiosk
systemctl status meticulous-kiosk
# Should show: "active (running)"
```

## Why Previous Fixes Didn't Work

1. **Socket wasn't actually removed**: `rm -f` failed silently, socket remained
2. **Process holding tty7**: We didn't kill the process on tty7
3. **Timing**: Services restarted before cleanup completed
4. **Permissions**: Root removing files that user needs to access

The `force-fix-xserver.sh` script addresses all of these:
- Uses `pkill -9` (force kill)
- Explicitly kills tty7 holder with `fuser -k`
- Recreates `/tmp/.X11-unix` directory with correct permissions
- Tests X manually before giving to systemd
- Verifies each step

## Next Steps

1. **Run the force fix script**
2. **If it succeeds**, try starting the kiosk:
   ```bash
   sudo systemctl start meticulous-kiosk
   ```

3. **If kiosk starts**, reboot to test auto-start:
   ```bash
   sudo reboot
   ```

4. **If force fix fails**, try the reboot option (Option 3)

5. **If still failing**, we may need to check:
   - GPU/graphics drivers
   - X server configuration
   - Hardware issues (display connection)

## Commands Quick Reference

```bash
# Pull latest fixes
cd ~/meticulous-display && git pull

# Run force fix
sudo bash scripts/force-fix-xserver.sh

# Check status
systemctl status xserver meticulous-kiosk

# View logs
journalctl -u xserver -n 50

# Kill everything (nuclear)
sudo pkill -9 X; sudo rm -rf /tmp/.X11-unix; sudo mkdir /tmp/.X11-unix; sudo chmod 1777 /tmp/.X11-unix

# Reboot
sudo reboot
```

## Getting More Help

If nothing works, gather this information:

```bash
# System info
uname -a
cat /etc/os-release

# Service status
systemctl status xserver --no-pager -l > ~/xserver-status.txt

# Full logs
journalctl -u xserver -b > ~/xserver-logs.txt

# Diagnostic output
sudo bash scripts/diagnose-xserver.sh > ~/xserver-diagnostic.txt

# Process list
ps aux | grep X > ~/xserver-processes.txt
```

Send those files for analysis.
