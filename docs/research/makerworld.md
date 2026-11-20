# Research — MakerWorld import

> Spike date: 2026-11-20 · Tested with plain `curl` from a residential IP (Spain).
> Models tested: 3029073 (10 profiles, multi-plate), 3012887 (12 profiles), 3057768 (5 profiles).
> **[V]** verified with real requests · **[I]** inferred, not verified.

## TL;DR

| Topic | Finding |
|---|---|
| Anti-bot | **No challenge today**. Pages and internal JSON API return 200 to plain server-side requests, any User-Agent. Cloudflare Bot Management is present (`__cf_bm` cookie) and could start enforcing. [V] |
| Best source | `GET https://makerworld.com/api/v1/design-service/design/{designId}` → ~350 KB JSON with all metadata **and all print profiles** (time, grams, filaments, plates, printers). No auth. [V] |
| Fallback 1 | HTML page (Next.js) → `__NEXT_DATA__` → `props.pageProps.design`: same object as the API. [V] |
| Fallback 2 | Open Graph meta: title, plain-text description, 1200 px cover. [V] |
| Model files | **Login required** (`403 "Please log in to download models."`) for 3MF, STL zip and viewer GLB. → manual upload. [V] |
| Images | Public CDN `makerworld.bblmw.com`, not signed, resizable: `?x-oss-process=image/resize,w_N/format,webp`. [V] |
| Legal | robots.txt allows `/`. The **User Agreement forbids automated access** ("page-scrape", "robot", "spider"). Most models use "Standard Digital File License" (no redistribution). |

**Decision**: import is user-triggered, one request per import, private family use, never republish; images copied locally; model files uploaded manually.

## URL parsing

```ts
const URL_RE = /makerworld\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?models\/(\d+)[^#]*(?:#profileId-(\d+))?/i
```
- `/es/models/<id>-<slug>` → 307 to `/en/...`; `/en/models/<id>` (no slug) → 307 to canonical. The id is enough. [V]
- `#profileId-<n>` is never sent to the server: parse it client/server side from the string. `<n>` = `instances[i].id`. [V]

## Data map (`D` = API root or `__NEXT_DATA__.props.pageProps.design`)

| Field | Path | Notes |
|---|---|---|
| id, slug | `D.id`, `D.slug` | |
| title | `D.title` | designer's language; `titleTranslated` = English, often empty |
| description | `D.summary` | **HTML** with CDN `<img>`, emoji, inline styles → sanitize |
| cover | `D.coverUrl` | |
| gallery | `D.designExtension.design_pictures[].url` | dedupe with cover; also `real_pictures[]` |
| tags | `D.tags[]` | may contain duplicates → normalise |
| designer | `D.designCreator.{name,handle,avatar}` | profile `https://makerworld.com/en/@{handle}` [I] |
| license | `D.license` | e.g. "Standard Digital File License" |
| category | `D.categories[]{id,name}` | leaf first |
| dates | `D.createTime`, `D.updateTime` | ISO UTC |
| counters | `downloadCount`, `likeCount`, `printCount` | |
| default profile | `D.defaultInstanceId`, order in `D.designExtension.instances_order[]` | |
| BOM / hardware | `D.designExtension.boms[]` | candidate source for "other materials" |
| profiles | `D.instances[]` | see below |

Profile `P = D.instances[i]`:

| Field | Path | Notes |
|---|---|---|
| id | `P.id` | = `#profileId-<n>` |
| name | `P.title` | |
| print time | `P.prediction` | **seconds**, sum of all plates |
| weight | `P.weight` | **grams**, sum of all plates |
| filaments | `P.instanceFilaments[]{type,color,usedM,usedG}` | `usedM`/`usedG` are **strings** |
| AMS | `P.needAms`, `P.materialCnt` | |
| plates | `P.extention.modelInfo.plates[]{index,name,prediction,weight,thumbnail.url,filaments[]}` | note the typo `extention` |
| main printer | `P.extention.modelInfo.compatibility.{devProductName,nozzleDiameter}` | e.g. `"A1 mini"`, `0.4` |
| other printers | `P.extention.modelInfo.otherCompatibility[].devProductName` | |
| re-sliced per printer | `P.extention.otherCompatibilityModelInfo[]{devProductName,prediction,weight,instanceFilaments}` | lets us show A1 mini figures even for profiles made for other printers |
| slicer settings | `P.extention.modelInfo.projectSettings.{layerHeight,wallLoops,sparseInfillDensity}` | often empty |
| images | `P.cover`, `P.pictures[].url` | |

Trimmed real example:
```json
{"id":3029073,"title":"Bambu scraper handle V3","slug":"bambu-scraper-handle-v3",
 "coverUrl":"https://makerworld.bblmw.com/makerworld/model/US793a221948f8cb/design/4eecadba4a669659.jpg",
 "license":"Standard Digital File License","defaultInstanceId":3404179,
 "tags":["scraper","scrapper","bed","BAMBU"],
 "designCreator":{"name":"MXDesign","handle":"mxdesign"},
 "instances":[{"id":3911936,"title":"(PETG) Scraper Holder - A1 Mini - Stackable Storage Stand V3",
   "prediction":6936,"weight":34,"needAms":false,
   "instanceFilaments":[{"type":"PETG","color":"#161616","usedM":"10.74","usedG":"34"}],
   "extention":{"modelInfo":{
     "compatibility":{"devProductName":"A1 mini","nozzleDiameter":0.4},
     "plates":[{"index":1,"name":"Logo","prediction":3511,"weight":17},
               {"index":2,"name":"No Logo","prediction":3425,"weight":17}]}}}]}
```

## Other endpoints (base `https://makerworld.com/api/v1/design-service`)

| Endpoint | Result |
|---|---|
| `GET /design/{id}` | 200 ✅ use this |
| `GET /design/{id}/instances` | 200 but includes hidden profiles, `detail` mostly empty → don't use |
| `GET /design/{id}/model`, `GET /instance/{id}/f3mf?type=download` | 403, login required |

## Images

- `makerworld.bblmw.com/makerworld/model/{modelId}/design/{hash}.jpg`, plates under `…/{profileId}/instance/plate_N.png`, avatars on `public-cdn.bblmw.com`.
- Public, `cache-control: max-age=31536000`, no Referer check.
- Download at import time with `?x-oss-process=image/resize,w_2560/format,webp` to save space.
- Content types are unreliable (`octet-stream`, `.jfif`) → sniff magic bytes.

## Extraction strategy (ordered)

1. Parse URL → `designId`, optional `instanceId`.
2. API `GET /design/{id}` (browser UA, `Accept: application/json`, 10 s timeout, 1 retry).
3. Fallback: HTML `/en/models/{id}` → `__NEXT_DATA__` → same mapper.
4. Fallback: OG meta → partial draft (`profiles: []`).
5. Blocked (403/503, `cf-mitigated` header, "Just a moment" / `cf_chl_opt` in HTML) → tell the user and open the manual form pre-filled with the URL. **Never try to bypass.**

Always validate with zod and store the **raw JSON** of the import (`project_sources.raw`) so the mapping can be redone if the format changes.

## Mapper sketch

```ts
export function mapDesign(D: any, selectedInstanceId?: number): ImportedProjectDraft {
  const order: number[] = D.designExtension?.instances_order ?? []
  const instances = [...(D.instances ?? [])].sort((a, b) =>
    (order.indexOf(a.id) + 1 || 1e9) - (order.indexOf(b.id) + 1 || 1e9))
  return {
    title: D.title,
    description: sanitizeHtml(D.summary ?? ''),
    images: uniq([D.coverUrl, ...(D.designExtension?.design_pictures ?? []).map((p: any) => p.url)].filter(Boolean)),
    tags: uniq((D.tags ?? []).map((t: string) => t.trim().toLowerCase()).filter(Boolean)),
    designer: D.designCreator?.name ?? null,
    designerUrl: D.designCreator ? `https://makerworld.com/en/@${D.designCreator.handle}` : null,
    license: D.license ?? null,
    sourceUrl: `https://makerworld.com/en/models/${D.id}-${D.slug}`,
    profiles: instances.map((P: any) => {
      const mi = P.extention?.modelInfo ?? {}
      return {
        externalId: P.id,
        name: P.title,
        printMinutes: P.prediction != null ? Math.round(P.prediction / 60) : null,
        grams: num(P.weight),
        filaments: (P.instanceFilaments ?? []).map((f: any) => ({ type: f.type, color: f.color, grams: num(f.usedG) })),
        printers: uniq([mi.compatibility?.devProductName, ...(mi.otherCompatibility ?? []).map((c: any) => c.devProductName)].filter(Boolean)),
        plates: mi.plates?.length ?? null,
        selected: P.id === (selectedInstanceId ?? D.defaultInstanceId),
      }
    }),
  }
}
```

## UX consequences

- In the import screen, profiles are listed and the one matching **A1 mini** (main or `otherCompatibilityModelInfo`) is preselected and labelled "your printer".
- The chosen profile pre-fills the first file iteration's **estimated** grams/time/filaments, waiting for the user to upload the 3MF (link "Open in MakerWorld to download" shown).
- BOM (`boms[]`) can pre-fill "other materials" — to check on models that use it.

## Risks

| Risk | Mitigation |
|---|---|
| Undocumented API; fields/units may change | zod validation, raw JSON stored, fallbacks |
| Cloudflare may start enforcing | manual fallback always available |
| ToS forbid automated access | user-triggered, low volume, private, cached, no redistribution |
| Description HTML | sanitize (allow-list), rewrite images to local copies or drop them |
