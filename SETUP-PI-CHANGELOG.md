# Setup Script Changelog

## Version 2.0 - Complete Boot Fix Integration

**Date:** 2024-02-05

### Overview
Complete rewrite of `scripts/setup-pi.sh` to be a single, comprehensive installation package that includes all necessary fixes for reliable boot-time startup.

### What's New

#### 🎯 Core Improvements

1. **Integrated Boot Fixes** ✨
   - No longer need to run `fix-kiosk-boot.sh` separately
   - All boot timing fixes built into the main setup
   - First-time installations work perfectly on reboot

2. **Upgrade Detection** 🔄
   - Automatically detects existing installations
   - Prompts before overwriting
   - Preserves `config/local.json` during upgrades
   - Safely stops services before upgrade

3. **Enhanced Service Configurations** 🔧
   - **Backend Service:**
     - Waits for `network-online.target` (not just `network.target`)
     - Uses `Restart=always` instead of `on-failure`
     - Proper journal output configuration

   - **X Server Service:**
     - Conflicts with getty@tty7 to prevent conflicts
     - Waits for systemd-user-sessions
     - Targets `graphical.target` instead of `multi-user.target`

   - **Kiosk Service:**
     - Strong dependency with `BindsTo=xserver.service`
     - Explicit readiness checks (max 60s for backend, 30s for X)
     - Active polling instead of fixed delays
     - Targets `graphical.target`

4. **Installation Verification** ✅
   - Comprehensive checks after installation
   - Verifies Node.js, Chromium, build artifacts
   - Checks service enablement status
   - Validates systemd target and user groups
   - Clear pass/fail indicators

5. **Better User Experience** 💡
   - Clear version information (v2.0)
   - Progress indicators with emojis
   - Helpful next steps with command examples
   - Links to troubleshooting documentation
   - Backup/restore of existing configs

### Technical Details

#### Service Dependency Changes

**Before (v1.x):**
```ini
# Weak dependencies
Wants=meticulous-display.service
After=network.target

# Fixed delays
ExecStartPre=/bin/sleep 15

# Wrong target
WantedBy=multi-user.target
```

**After (v2.0):**
```ini
# Strong dependencies
BindsTo=xserver.service
After=network-online.target
Wants=network-online.target

# Active readiness checks with timeouts
ExecStartPre=/bin/bash -c 'timeout 60 bash -c "until systemctl is-active --quiet meticulous-display.service; do sleep 1; done"'
ExecStartPre=/bin/bash -c 'timeout 30 bash -c "until xset -display :0 q &>/dev/null; do sleep 1; done"'

# Correct target
WantedBy=graphical.target
```

#### New Features

1. **Config Preservation**
   ```bash
   # Backs up config during upgrade
   BACKUP_CONFIG=$(cat $APP_DIR/config/local.json)
   # ... copy files ...
   # Restores config
   echo "$BACKUP_CONFIG" > $APP_DIR/config/local.json
   ```

2. **Upgrade Detection**
   ```bash
   if [ -d "$APP_DIR" ] && [ -f "/etc/systemd/system/meticulous-display.service" ]; then
     IS_UPGRADE=true
     # Prompt user and stop services
   fi
   ```

3. **Installation Verification**
   ```bash
   # Check Node.js
   if ! command -v node &> /dev/null; then
     echo "❌ Node.js not found"
   fi
   # ... more checks ...
   ```

4. **Network-Online Target**
   ```bash
   systemctl enable systemd-networkd-wait-online.service
   ```

5. **Default Target Setting**
   ```bash
   systemctl set-default graphical.target
   ```

### Migration from v1.x

If you previously installed with an older version:

**Option 1: Fresh Install (Recommended)**
```bash
cd /opt/meticulous-display
git pull
sudo bash scripts/setup-pi.sh
# Will detect upgrade and preserve config
```

**Option 2: Manual Fix**
```bash
sudo bash scripts/fix-kiosk-boot.sh
sudo reboot
```

### Files Modified

- ✅ `scripts/setup-pi.sh` - Complete rewrite with v2.0 features
- 📝 `KIOSK-BOOT-FIX.md` - Detailed explanation (kept for reference)
- 📝 `SUMMARY-KIOSK-FIX.md` - Quick reference (kept for reference)
- 📝 `PI-TROUBLESHOOTING.md` - Updated with boot fix section
- ⚡ `scripts/fix-kiosk-boot.sh` - Standalone fix (kept for manual repairs)

### Breaking Changes

None! The script is backward compatible and safely upgrades existing installations.

### Known Issues

None currently. If you encounter issues:
1. Check logs: `journalctl -u meticulous-kiosk.service -b`
2. Run diagnostics: `sudo bash /opt/meticulous-display/scripts/troubleshoot-pi.sh`
3. See [PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md)

### Testing

Verified on:
- ✅ Raspberry Pi Zero 2W
- ✅ Raspberry Pi OS Lite (Bookworm)
- ✅ Fresh installations
- ✅ Upgrades from v1.x

### Performance

**Boot Time (Power-on to Dashboard):**
- v1.x: ~30-45 seconds (with manual fix)
- v2.0: ~30-45 seconds (automatic)

**Reliability:**
- v1.x: Required manual `fix-kiosk-boot.sh` after setup
- v2.0: Works immediately after first reboot ✅

### Future Improvements

Potential enhancements for future versions:
- [ ] Interactive configuration wizard
- [ ] Automatic machine IP detection
- [ ] Health check endpoint
- [ ] Automatic updates
- [ ] Rollback capability

### Credits

This version incorporates solutions to the boot timing issue discovered through systemd service dependency analysis and testing on Raspberry Pi Zero 2W hardware.

### Related Documentation

- [KIOSK-BOOT-FIX.md](KIOSK-BOOT-FIX.md) - Detailed technical explanation
- [PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md) - Troubleshooting guide
- [README.md](README.md) - General documentation

---

**Version History:**

- **v2.0** (2024-02-05): Complete boot fix integration, upgrade detection, verification
- **v1.0** (2024-01-29): Initial release
