# Database Migration Guide

## Overview

This document describes the database schema changes for profile image support and how to migrate existing databases.

## Changes Made

### New Columns Added to `shots` Table

1. **`profile_image`** (TEXT) - URL to the profile image on the Meticulous machine
2. **`profile_image_local`** (TEXT) - Local filesystem path to cached profile image

### New Configuration Options

Added to `config/default.json`:

```json
{
  "cache": {
    "resetSchemaOnStart": false,  // Preserve data on restart
    "imagesPath": "./data/images"  // Directory for cached profile images
  }
}
```

## Migration Instructions

### Automatic Migration

Run the migration script to add missing columns to an existing database:

```bash
npm run migrate
```

This will:
- Check if the required columns exist
- Add missing columns if needed
- Report the final schema

### Manual Migration (if needed)

If you need to manually add the columns:

```sql
ALTER TABLE shots ADD COLUMN profile_image TEXT;
ALTER TABLE shots ADD COLUMN profile_image_local TEXT;
```

### Fresh Database

If you want to start with a fresh database (⚠️ **WARNING: This will delete all data**):

1. Stop the server
2. Delete the database file: `rm data/history.db`
3. Start the server - it will create a new database with the correct schema

### Verification

Check the database schema after migration:

```bash
node scripts/check-db.js
```

Expected output should include both new columns:

```
--- Table: shots ---
  id: INTEGER NOT NULL PRIMARY KEY
  machine_id: TEXT NOT NULL PRIMARY KEY
  time: INTEGER NOT NULL
  profile_name: TEXT NOT NULL
  profile_id: TEXT
  profile_image: TEXT           ← NEW
  duration: REAL
  yield_weight: REAL
  rating: TEXT
  has_full_data: INTEGER
  data: TEXT
  created_at: INTEGER
  profile_image_local: TEXT     ← NEW
```

## Impact on Existing Data

- **No data loss**: Existing shots remain intact
- **Backward compatible**: Old shots will have `NULL` for the new columns
- **Forward compatible**: New shots will populate both columns when available

## Profile Image Caching

### How It Works

1. When fetching shot history from the machine, if a shot has a `profile.display.image` URL:
   - The URL is stored in `profile_image`
   - The image is downloaded from the machine using axios
   - The downloaded image is saved to `./data/images/{hash}.{ext}`
   - The local path is stored in `profile_image_local`

2. Images are served via `/api/profile-image/:filename` endpoint
   - **Proxied through server** (not redirected) to avoid CSP violations
   - Cached locally for performance
   - 24-hour cache headers for browser caching

3. Images are only downloaded once (checked by `profile_image_local` field)

### Image Cache Directory Structure

```
data/
├── history.db          # SQLite database
└── images/             # Cached profile images
    ├── abc123.jpg      # Hashed filename
    ├── def456.png
    └── ...
```

### Cache Management

- Images are stored indefinitely (no automatic cleanup)
- To clear cache: `rm -rf data/images/*`
- Images will be re-downloaded on next history refresh

## Troubleshooting

### Error: "no such column: profile_image_local"

**Cause:** Database schema is outdated

**Solution:** Run the migration script:
```bash
npm run migrate
```

### Error: "SQLITE_ERROR: no such table: shots"

**Cause:** Database file is empty or corrupted

**Solution:** Delete and let it reinitialize:
```bash
rm data/history.db
npm run build
npm start
```

### Images Not Displaying

**Possible causes:**

1. **Machine not connected:** Images can only be downloaded when the machine is reachable
2. **Image URL missing:** Some profiles may not have images
3. **Download failed:** Check server logs for axios errors
4. **Path mismatch:** Verify `config.cache.imagesPath` is correct

**Debug steps:**

1. Check server logs: `journalctl -u meticulous-display -f` (on Pi)
2. Verify image directory exists: `ls -la data/images/`
3. Test image endpoint: `curl http://localhost:3002/api/profile-image/[filename]`
4. Check database: `node scripts/check-db.js`

## Rollback

If you need to roll back to the previous version without profile images:

1. Checkout the previous commit: `git checkout [previous-commit]`
2. Rebuild: `npm run build`
3. Restart: `npm start`

The new columns will remain in the database but will be ignored by the old code.

## Version Compatibility

- **Current version:** 1.1.0 (with profile images)
- **Previous version:** 1.0.0 (without profile images)
- **Database schema version:** 2

## Future Migrations

To add future schema changes:

1. Update `src/server/cache.ts` `initSchema()` method
2. Create a new migration script in `scripts/migrate-v{version}.js`
3. Test migration on a copy of production database
4. Document changes in this file
5. Update schema version

---

**Last Updated:** 2026-02-02
**Migration Script:** `scripts/migrate-db.js`
**Check Script:** `scripts/check-db.js`
