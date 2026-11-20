# Research — Bambu Studio / OrcaSlicer 3MF and STL

> Spike date: 2026-11-20 · **[V]** verified on real public files or slicer source · **[I]** inferred.
> Working prototype: [prototypes/parseBambu3mf.ts](prototypes/parseBambu3mf.ts) (fflate + fast-xml-parser, tested on all samples).

## Samples used

13 real public files: Bambu Studio projects (A1 mini, 1–2 plates, 4-colour), sliced `.gcode.3mf` (BS 1.7 → 2.9, X1C, H2C, multi-plate, 4-colour), OrcaSlicer 2.4 projects, generic CAD 3MF, SuperSlicer 3MF, binary/ASCII STL, plus 9 `slice_info.config` files from GitHub (BS 1.3 → 2.6).

## TL;DR

| Need | Sliced `.gcode.3mf` | Un-sliced project `.3mf` |
|---|---|---|
| Print time | ✅ `slice_info.config` `prediction` (s) | ❌ |
| Grams / metres per filament | ✅ `<filament used_g used_m>` | ❌ |
| Filament type / colour | ✅ | ✅ from `project_settings.config` |
| Plates | ✅ | ✅ |
| Thumbnails | ✅ `Metadata/plate_N.png` (512 px) | ✅ |
| Printer / nozzle / layer height | ✅ | ✅ |
| Bounding box | ⚠️ no mesh; `max_z_height` from gcode + slicer's "fits" flag | ✅ computed from mesh |
| 3D preview | ❌ no mesh → show thumbnail | ✅ three.js 3MFLoader ≥ r174 |

- `isSliced` ⇔ `slice_info.config` contains at least one `<plate>`.
- OrcaSlicer uses the same container (forked code) → one parser for both.
- Parsing takes 18–72 ms on samples; meshes up to ~400 ms for 65 MB inflated.

## ZIP layout [V]

Un-sliced Bambu project:
```
3D/3dmodel.model                 root: metadata + components (p:path) + build items
3D/Objects/object_N.model        meshes (production extension; Orca/BS1.7: "<name>_<id>.model")
Metadata/project_settings.config JSON (~600 keys, all string values)
Metadata/model_settings.config   XML: objects, parts (extruder), plates
Metadata/slice_info.config       header only
Metadata/plate_N.png | plate_N_small.png | top_N.png | pick_N.png | plate_N.json
```
Sliced `.gcode.3mf` adds `Metadata/plate_N.gcode` (+ `.md5`), `<plate>` blocks in `slice_info.config`, and **drops the meshes** (`3D/3dmodel.model` is empty).

## Where values live [V]

`Metadata/slice_info.config` (sliced only):
```xml
<header><header_item key="X-BBL-Client-Version" value="02.09.01.70"/></header>
<plate>
  <metadata key="index" value="1"/>
  <metadata key="printer_model_id" value="BL-P001"/>
  <metadata key="nozzle_diameters" value="0.4"/>
  <metadata key="prediction" value="30742"/>  <!-- seconds -->
  <metadata key="weight" value="224.11"/>     <!-- grams -->
  <metadata key="outside" value="false"/>     <!-- true = doesn't fit the bed -->
  <filament id="1" tray_info_idx="GFB99" type="ABS" color="#00AE42" used_m="89.59" used_g="224.11"/>
</plate>
```
- `<filament id>` = 1-based index into the project's filament list, **not the AMS slot**; only used filaments are listed (e.g. ids 1,2,3,10).
- `tray_info_idx` = Bambu filament preset (GFA00 = PLA Basic, GFL99 = Generic PLA). Absent in BS 1.x.
- Printer ids: **A1 mini = `N1`**, A1 = N2S, P1S = C12, X1C = BL-P001, X1 = BL-P002, H2C = O1C2, H2D = O1D.

`Metadata/project_settings.config` (JSON, both kinds), real A1 mini example:
```json
"printer_model":"Bambu Lab A1 mini", "nozzle_diameter":["0.4"], "layer_height":"0.2",
"printable_area":["0x0","180x0","180x180","0x180"], "printable_height":"180",
"filament_type":["PETG"], "filament_colour":["#FFFFFF"], "filament_ids":["GFG99"]
```
Projects may configure more filaments than they use (12 configured, 4 used).

`3D/3dmodel.model` metadata: `Application=BambuStudio-…`, Title, Designer, License, and `DesignModelId` / `ProfileTitle` when downloaded from MakerWorld → **links an uploaded file back to its MakerWorld project**. Orca also writes `Application=BambuStudio-…`; detect it via `<metadata name="OrcaSlicer">` or the `OrcaSlicer-Version` header.

G-code header (fallback source): `; total estimated time`, `; total filament weight [g]`, `; max_z_height` (BS 2.x; BS 1.7 lacks weight and max_z).

## Bounding box ("does it fit the A1 mini 180×180×180?")

- `plate_N.json` is **not** the model bbox: it's the 2D first-layer footprint (and may include the wipe tower). [V]
- **Projects**: compute from the meshes: build item transform × component transform × vertices (3×4 row-major matrices; rotations occur). One bbox per build item, grouped by plate (`model_settings` `model_instance`). Plates are laid out side by side in build space → **never union across plates**. [V]
- **Sliced files**: simplest rule — if `printer_model_id == "N1"` and `outside == "false"`, the slicer already guarantees it fits; otherwise flag "sliced for another printer". Z from `max_z_height` (only the first 64 KB of gcode needs inflating).
- **STL**: min/max of all vertices; no units (assume mm); report "fits" / "fits rotated" / "too big" comparing sorted dimensions.

## 3D preview (three.js) [V]

- Bambu/Orca projects use split files (production extension); `3MFLoader` supports this only **since r174** (Feb 2025).
- It renders in a single colour (ignores extruders and painted facets) and shows all plates side by side.
- `.gcode.3mf` has no mesh → show `plate_N.png` instead of a 3D viewer.
- Load in a Web Worker for big files; STLLoader handles binary and ASCII.

## Robustness rules

- Every key optional; values are strings; lists are JSON arrays or `;`/`,` joined; colours may be `#RRGGBBAA` → keep 7 chars.
- Plates = union of `model_settings` plates and `slice_info` plates (multi-plate projects may slice only plate 1).
- **Zip-bomb guard**: cap entry count (~5000), per-entry inflated size (~500 MB) and total.
- Never inflate the whole gcode unless needed (179 MB `.gcode.3mf` files exist).
- Never use entry names as file paths (path traversal); store thumbnails by plate index after checking PNG magic bytes.
- Parse in a worker thread so uploads don't block Nitro.
- PrusaSlicer/SuperSlicer 3MF: no Bambu metadata → mesh bbox only.
- STL binary detection: `size == 84 + 50 × n`, **not** the `solid` prefix.

## Observed sizes

| Kind | Observed |
|---|---|
| `.gcode.3mf` (65 public files) | median 0.7 MB · p75 3.5 MB · p90 7.3 MB · max 175 MB |
| Bambu/Orca project `.3mf` | 0.5–2.5 MB (one re-saved 21 MB) |
| Generic CAD 3MF | 5–17 MB |
| STL | 43 KB – 11 MB (ASCII ≈ 3× binary) |

→ Limits adopted: model file 250 MB hard cap (warning above 50 MB). See PROJECT_PLAN §6.

## Product consequences

1. Uploading a **sliced `.gcode.3mf` auto-fills** time, grams per filament, colours, plates and thumbnail of a file iteration → cost computed with zero typing. This is the recommended workflow (export "sliced file" from Bambu Studio).
2. Uploading a **project `.3mf`** auto-fills filaments/colours, plates, thumbnails and the bbox fit check; time/grams stay manual or come from the MakerWorld profile.
3. Status can be **suggested automatically**: uploading a sliced file for the A1 mini → propose moving to `sliced`.
4. Filament presets (`tray_info_idx`) can be matched against the filament catalogue to pre-select brand/type.
5. Since 3MF parsing is cheap and very valuable, it moves from v1.x to the **MVP**.
