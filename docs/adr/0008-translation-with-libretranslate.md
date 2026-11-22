# ADR 0008 — Translate imported texts to Spanish with a self-hosted LibreTranslate

- Status: accepted · 2026-11-22

## Context
MakerWorld models come in the designer's language (German, Chinese, English…). The design API only
adds an English translation (`titleTranslated`, `summaryTranslated`, `tagsTranslated`) and ignores
any language hint (`Accept-Language`, `lang` query, cookies: verified). The family wants the
catalogue in Spanish, without signing up for any service.

Options weighed:
- **DeepL API Free**: best quality, but needs an account (and a card to verify it). Discarded by the owner.
- **Chrome's built-in Translator API** (on device): desktop only, not on Android, where 3tero is used most.
- **Google Translate's internal endpoint without a key**: not a public API, against its terms, rate-limited. Discarded.
- **LibreTranslate on the mini PC**: no account, texts stay at home; one more container, slower on CPU,
  weaker quality (it pivots through English: "Zahnstocher Spender" → "Donante de dientes").

## Decision
- **LibreTranslate** (`libretranslate/libretranslate`, pinned) runs on the server as a shared
  service of its own (other home apps may use it), not published through the proxy, with the
  languages found on MakerWorld (`LT_LOAD_ONLY`). 3tero calls it at `NUXT_TRANSLATE_URL`; without it
  the feature is hidden, and when it is down the button reports it.
- On the import review page, **"Traducir al español"** translates title, description and tags;
  **"Ver original"** restores them. Only on demand, and the user reviews before saving.
- LibreTranslate detects **one source language per request**, so title, tags and description go as
  separate requests; a long description is split into up to 4 consecutive chunks run in parallel
  (its default thread count), and list markers are kept out of the translation
  (`server/lib/translators/libretranslate.ts`).

## Consequences
- No account, no key, no data leaving home; the app works the same when the translator is down.
- Measured on a 2015 i5 (similar to the N97): ~25 s for the first request after a restart (models
  loading), then a 3 600-character description + title + 12 tags in ~33 s. The button says it may take
  up to a minute. Single-word tags translate poorly (no context): review them.
- Models: ~700 MB for 3 languages, ~250 MB RAM idle; downloaded on first start, so the container
  needs Internet access once.
- Swapping to another service later only means another client with the same shape.
