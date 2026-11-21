# Database setup (existing PostgreSQL server)

Requires PostgreSQL ≥ 13. Run once as an admin user (replace the password):

```sql
CREATE ROLE trestero LOGIN PASSWORD 'change-me';
CREATE DATABASE trestero OWNER trestero;
```

The app connects with `DATABASE_URL=postgres://trestero:change-me@<host>:5432/trestero` and on startup:
1. creates the trusted extensions it needs (`unaccent`, `pg_trgm`) if missing,
2. applies pending migrations under an advisory lock.

No manual SQL is needed after this step.

## Backups
```bash
pg_dump -Fc -h <host> -U trestero trestero > trestero-$(date +%F).dump   # database
tar czf trestero-data-$(date +%F).tgz ./data                         # uploads
```
Take a dump before deploying a release that contains migrations.
