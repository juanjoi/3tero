# Database setup (existing PostgreSQL server)

Requires PostgreSQL ≥ 13. Run once as an admin user (replace the password):

```sql
CREATE ROLE layra LOGIN PASSWORD 'change-me';
CREATE DATABASE layra OWNER layra;
```

The app connects with `DATABASE_URL=postgres://layra:change-me@<host>:5432/layra` and on startup:
1. creates the trusted extensions it needs (`unaccent`, `pg_trgm`) if missing,
2. applies pending migrations under an advisory lock.

No manual SQL is needed after this step.

## Backups
```bash
pg_dump -Fc -h <host> -U layra layra > layra-$(date +%F).dump   # database
tar czf layra-data-$(date +%F).tgz ./data                         # uploads
```
Take a dump before deploying a release that contains migrations.
