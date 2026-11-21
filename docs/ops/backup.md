# Backup & restore

Two complementary layers:

## 1. In-app backup (portable, recommended for families)

**Ajustes → Copia de seguridad → Descargar copia** (`GET /api/backup`) streams one ZIP:

```
3tero-backup.json        every table (format 1, app "3tero", migrations count, exportedAt)
media/projects/<id>/…    images (.webp + thumbnails), model files, print photos
```

- Streamed in both directions (fflate `Zip` / `Unzip`): multi-GB backups never sit in memory.
- Media entries are stored without compression (WebP/3MF are already compressed).

**Restore** (`POST /api/backup/restore`, multipart `file` + field `confirm=REPLACE`) replaces **all** data:

1. Unzips media into `tmp/restore-<uuid>/` and parses the JSON (only `media/projects/**` entries are accepted; others are ignored).
2. Validates `app`, `format` and that the backup is not from a newer schema (`migrations` ≤ current).
3. One transaction: `TRUNCATE` every table, insert rows with `json_populate_recordset`, only the columns present in the backup (older backups get defaults for newer columns).
4. Swaps `projects/` with the staged folder.

A failure before step 4 leaves the current data untouched (verified with an invalid ZIP).

Moving to another machine: install with Docker (README), open the app, restore the ZIP.

## 2. Infrastructure backup (optional, for automation)

- Database: `pg_dump -Fc trestero > trestero.dump` (see [database.md](database.md)).
- Files: copy the `./data` folder mounted by `docker-compose.yml` (`tar czf data.tgz -C ./data projects`).

Run both at the same moment so database rows and files match.
