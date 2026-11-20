---
name: ynot-artwork-spec
description: Build a Y-Not product artwork / specification sheet (PO spec) in Adobe Illustrator from a client mockup PPT and logo files, following the Y-Not Design SOP. Use when the user asks for an artwork, spec sheet, spec design, PO artwork or "specs" for a product (t-shirt, bag, bottle, hat, etc.), or hands over a mockup PPT and logos to turn into a production artwork.
---

# Y-Not Artwork / Spec Sheet

Output: one editable Illustrator file (+ PDF) that a manufacturer can build the product from.
Source of truth: Y-Not "Design SOP – Artwork Creation" (24/06/2024) and the layout of
`10962 - CCL - COSTA Brand T-Shirt - Specs-101`.

The user supplies the mockup PPT, logo files (vector: .ai/.svg/.eps/.pdf) and product photos.
Never fetch from Box/Odoo/OneDrive. Never invent specs — anything not in the inputs is asked.

**Skill folder:** the "Base directory for this skill" shown when the skill loads (`<skill>` below). Use absolute
paths built from it, because the session's working directory can be anywhere. Works on Windows and macOS.
- `scripts/extract_pptx.py`: dumps the PPT's text and images (needs `pip install python-pptx`)
- `scripts/yn_lib.jsx`: Illustrator drawing helpers + QC checker + logo colour reader; loads `yn_box.jsx`
  (box dielines) and `yn_sheet.jsx` (spec.json → whole sheet builder) by itself
- `scripts/color.py`: Lab conversion, ΔE scoring and the Pantone lookup cache (use `python3` on macOS)
- `references/product-types.md`: per-product checklists, section order, wording and dielines. **Read it at step 3.**

**Job folder:** keep every working file (the extract, `build.jsx`, previews) in one folder next to the mockup PPT, `<OPP>_work/`.
Save the final .ai/.pdf where the user says.

**Before starting, check:**
- The `adobe` MCP is connected: call its `status` tool; Illustrator must show as running. If the tool is missing,
  tell the user to install the adobe-mcp from the ynot-skills repo (see its README) and restart Claude.
- Chrome is signed in to connect.pantone.com (needed for Pantone matching).

**Self-test** (after changing any script): `run_jsx({app:"illustrator", file:"<skill>/test/selftest.jsx", include:["<skill>/scripts/yn_lib.jsx"], rollbackOnError:true})` must return `ok`.

**Running scripts:** always `run_jsx({app: "illustrator", file: "<job>/build.jsx", include: ["<skill>/scripts/yn_lib.jsx"],
rollbackOnError: true})`. Scripts can return objects (they come back as JSON) and can use `JSON.parse`/`JSON.stringify`.
Errors name the file and line. Check every result visually with the `preview` tool (add `region` in inches to zoom).
**The user may be working in Illustrator at the same time.** Never rely on the active document: return `YN.doc.name`
from the build and pass it as `document` to `preview` and as `doc` to `ynQC`. Keep each script short where you can:
Illustrator is frozen for the user while a script runs. If `status` says busy, a dialog the user has open may be blocking it; ask.

## Workflow (do not skip or reorder)

Principle: **the user does the minimum, Claude does the rest — but never builds on half the
information.** Derive everything derivable (measure, convert, read swatches, count colours, draw
dielines); ask only for what can't be derived; build only when every required field is filled.

### How to ask (every step that asks the user anything)
The user wants **dialog boxes, one question at a time**, never a typed list of questions in chat (decided 2026-11-17).
- Use `AskUserQuestion`. Give each piece of information its own question, so it shows as its own tab. Up to 4 questions
  per call; for more, make further calls.
- Every question needs 2–4 options. Make them real choices: values you detected, the likely answers, or "Read it from the
  mockup PPT". Put the recommended one first, marked "(Recommended)". The user types anything else in the built-in
  "Other" box, so never add an "Other" option yourself.
- Don't write the questions out in chat as well. Before the dialog, write at most one line of context.
- Only when `AskUserQuestion` isn't available (e.g. a plain chat client), ask one question per message.

### 1. Project
First look in the working folder for a mockup PPT or logo files. Filenames often carry
`<OPP> - <Client> - <Project>`, so parse them. Then make **one `AskUserQuestion` call with 3 questions**:
1. **OPP No.** (header `OPP No.`): options are the number detected in a filename, and "Read it from the mockup PPT".
2. **Client** (header `Client`): the detected client first, then the frequent Y-Not clients:
   `CCL (Carnival Cruise Line)`, `Google`, `T-Mobile`, `NCL (Norwegian Cruise Line)`. Others: Zix Corporation,
   Encore, RCCL, State Farm, MLB, Ocasa, Sandals. These come in via "Other".
3. **Project / product** (header `Project`): the detected project name, and "Read it from the mockup PPT".

These give the title, exactly like `11023 - T-Mobile - Keyboard Keys Fidget Charm`, and the filename.

### 2. Share everything (one free-form message)
Don't ask which information the user has, and never show a "which of these do you have?" checkbox (user's
decision, 2026-11-17). Ask once, in plain chat, for **everything they have, in any order or format**: files or
paths (mockup PPT, logos, photos, BOM, brand guide, PDFs) plus any specs as loose text or pasted emails, e.g.
"12 oz, ceramic body, cork base, lid grey, laser logo 2 in wide, made in China". This is the one exception to
"How to ask": a dialog can't hold pasted text or files.
- Keep it to one or two lines and give a short example; don't list the fields.
- If the user has already shared files or details, skip this ask and go straight to step 3.

### 3. Collect, extract + segregate
Sort everything the user gave into the intake fields (step 4). Each value gets its source; unclear or
contradictory items are noted for step 5. Work out the product type from what they shared. Ask it as a dialog
question only if it is still unclear. Then use **`references/product-types.md`** for that type's required (A/U)
and suggested (S) fields, section order, wording and dieline construction. It covers every product type learned
from 155 team sheets. Classify by the **actual product** shown, not the folder or filename; about 1 in 4 training
files were filed under the wrong category.
Run `python scripts/extract_pptx.py "<mockup.pptx>" "<out_dir>"` (dumps every slide's text, tables
and notes to `<out_dir>/pptx.txt`, saves embedded images to `<out_dir>/media/`). Read the text and look
at every image. Also read any extra files the user gave (PDF, xlsx BOM, emails pasted in chat).

### 4. Fill the intake table + derive
Map what you found onto the fields below. Each field gets a value and a source:
`PPT slide N`, `logo file`, `user`, `derived`, or `MISSING`. Derive before asking:
- **Logo colours / count**: SVG logos: `ynSvgColors(path)` gives the exact hex values written in the file, plus a count of
  embedded images (raster parts can't be matched; say so). Other formats: place the logo and call `ynLogoColors(item)`: every fill/stroke/gradient stop as hex, largest
  area first, with existing spot names and a count of raster parts (raster parts can't be matched; say so). Ignore
  colours with a tiny area (anti-alias slivers) after checking them in a zoomed `preview`.
- **Pantone matching**: Claude does all of it (tested 2026-11-17). The Pantone Connect plugin is only a webview of
  connect.pantone.com, so use the website in the user's Chrome, which the user keeps signed in.
  1. **Pantone colours already in the logo**: open the logo in Illustrator and read `doc.spots`. If it has PANTONE spots,
     use them as they are.
  2. **Brand guidelines win**: if the client's brand guide names a PMS, use that one, even when another
     Pantone is a closer match.
  3. **Otherwise, look up each logo colour** (hex). First `python -I <skill>/scripts/color.py lookup <HEX>`: a hit
     returns the code + Lab already read from Pantone Connect for that exact hex, so skip the web lookup. On a miss, open
     `https://connect.pantone.com/convert?pantoneBook=pantoneSolidCoated&colorSpace=hex&hexValue=<HEX>&results=true`,
     wait ~3 s, then `get_page_text`. You get the Best Match, Alternatives 1–4, and COLOR DATA with the Lab value.
     - Use another book for other materials: `pantoneSolidUncoated` (U) for uncoated paper or kraft,
       and the TCX/TPG books for fabric.
  4. **Score + cache the match**: `python -I <skill>/scripts/color.py save <HEX> <CODE> <L> <a> <b>` stores it and prints the ΔE00. Under 2 is fine; 2–3, tell the user;
     over 3, flag it and offer the alternatives. Example: #E20074 → 214 C gave ΔE 3.33, a bright screen colour
     with no close Pantone.
  5. **Create the swatch**: `ynAddSpot('PANTONE 214 C', {l:46.89, a:70.91, b:7.10})` makes a Lab spot named exactly
     the way the plugin names it. Use it on the chips and the logo.
  6. **Never type Pantone values from memory.** The account is the "Explorer" tier: if lookups stop working, tell the user.
- **Logo size**: logos come in any aspect ratio (never assume square). Fit the logo into the
  imprint area keeping its ratio; if only one side is given, compute the other. Always report
  both W × H. Never stretch.
- **Measurements from the mockup**: with one known dimension (user-given) as the scale, measure
  the rest in pixels proportionally; mark them `derived (~)` so the user checks them in step 6.
- **Boxes without an open view**: draw the open view and the dieline yourself (see Dieline below)
  from box style + L × W × H + board thickness. Ask only for the box style if it isn't clear.

| # | Field | Notes |
|---|---|---|
| 1 | Global / Local sourcing | |
| 2 | OPP/PO No., Client 3-letter code, Project name | needed for title + filename |
| 3 | Product name | |
| 4 | Product colour (PMS) | CMYK if no Pantone |
| 5 | Product dimensions | inches + cm; size chart for apparel |
| 6 | Weight / capacity | GSM / oz for fabric |
| 7 | Logo(s) | one per print location |
| 8 | Logo colours (PMS) | every colour used in each logo |
| 9 | Logo position | per location, with offsets (e.g. "1.5 in above sleeve edge") |
| 10 | Brand guidelines check | which logo version, clear space, colour rules |
| 11 | Imprint method | screen print / embroidery / DTF / laser / deboss … |
| 12 | Imprint colour count | 1C / 2C / 4C / full colour, underbase yes/no |
| 13 | Imprint size | W × H, inches + cm |
| 14 | Material + finish | |
| 15 | Callouts | construction details to point at (stitching, seams, hinge …) |
| 16 | Child parts | BOM — each part: name, material, finish, dims |
| 17 | Made in | country → "MADE IN <COUNTRY> BY Y-NOT.COM" |
| 18 | Compliance | wash care, choking hazard, FDA, Prop 65 … (content from QC team) |
| 19 | Images | front / back / side views, detail photos |
| 20 | Packaging required + type | poly bag, box, hang tag … |
| 21 | Packaging dimensions / qty / master carton | case pack split by size |
| 22 | Packaging content | inserts, extra items |
| 23 | UPC | client-provided or from Y-Not UPC list — never pick one yourself |
| 24 | Product manual | if electronic |
| 25 | Tolerance | default "±0.5 in" only if the user confirms |
| 26 | Finish per surface | e.g. soft enamel, polished, glossy lamination, UV |
| 27 | Variants | sizes, numbers or colourways that each need their own 1:1 artwork |
| 28 | Separate packaging sheet? | gift box or mailer gets its own spec file with the same OPP |
| 29 | Certification marks | CE / FCC / RoHS: only if the user confirms |

### 5. Ask for gaps
Ask for every `MISSING` field this product needs in dialog boxes, one field per question and up to 4 per call,
in the order Product → Logo & Print → Packaging → Compliance. Each question offers the likely values, with the
suggested default first (e.g. Made in: "China (Recommended)", "India", "Vietnam"). Ask contradictions you
spotted as their own question, offering both readings (e.g. "Print colours: 5 (matches the logo's 5 PMS)" /
"2 (as written in the PPT)"). Keep asking until nothing required is missing.

### 6. Confirm
Show the complete table (all fields, value + source) and the section plan (which sections, which
image/logo goes where, derived measurements highlighted), then one dialog question: "Approve and build
(Recommended)" / "Change something". If the user picks change, ask which field in a dialog, update it, and show the
summary again. Only an explicit approve starts the build.

### 7. Build in Illustrator
Keep the brief (every confirmed value) in `<job>/spec.json`. Put the sheet itself under its `"sheet"` key in the
section format of `scripts/yn_sheet.jsx` (mockup / artwork / image / specs / dieline / notes, in the product type's
section order from `references/product-types.md`), so each number is typed only once. Then `<job>/build.jsx` is:
```js
var JOB = "<job>/";   // absolute, forward slashes, trailing slash
var r = ynBuildSheet(JSON.parse(ynRead(JOB + "spec.json")).sheet, JOB);
// extra one-off drawing for this product goes here (ynPath, ynCallout, ...)
r
```
Run it with `run_jsx` (see "Running scripts" above). Mockup dims and callouts are FRACTIONS of the mockup image
(0..1, measured on the image), so they stay on target whatever size the image lands at. Anything the builder doesn't
cover (flat product drawings, size charts, custom panels) goes after the builder call with the helpers below; use
`ynShiftBelow(y, dy)` to make room. Everything stays editable.

### 8. Preview and self-check
1. `preview` the whole sheet, then zoom into each section with `region` (inches); fix overlaps, clipping, stray items.
2. Run `run_jsx({app:"illustrator", code:"ynQC({opp:'<OPP>'})", include:[...]})`. It returns `{ok, issues}`:
   non-Arial fonts, inch/cm mismatches, chips without a spot (or spots without a chip), placeholder text,
   overset text, items off the artboard, missing links, file name. Fix every issue and run it again
   (run it once more after saving, for the file-name check).
3. Then go through the **QC checklist** and the "Mistakes" list. Report what you checked and anything still open.

### 9. Save
`<OPP>-<CLIENT>-<PROJECT>-SPEC-<VER>-<YYYYMMDD>.ai` + same-name `.pdf`.
Always use VER `101`; the team renames versions themselves, so don't ask. Date = file creation date. Save where the user says
(default: next to the mockup PPT). Uploading to OneDrive / posting in Odoo is the user's job.

## Layout

Studied from 9 real Y-Not sheets (plus 155 + 20 more for `references/product-types.md`):
COSTA V-neck tee, baby bib, projection alarm clock + its gift box, milestone coin + its packing box,
hang tag, T-Mobile fidget charm, and a presentation board.

### Page frame (always)
- One tall portrait artboard, ~10–14 in wide; height grows with content (sheets run 18–50 in tall).
  White background.
- **Title** centred above the boxes: `<OPP> - <CLIENT> - <Program/Brand> - <Product>` bold ~23 pt, black
  (#231F20). A long title may wrap to 2 lines, with the product on line 2. Then `Specs` bold, cyan.
- Content sits in full-width section boxes with thin black borders. A row may split into 2 columns
  divided by a vertical rule (e.g. Logo | Logo, Specs | Labels, User Manual | Accessory).
- Each section header is centred, bold and cyan. The imprint method goes on a second cyan line in
  brackets: `Logo Artwork` / `(Silkscreen)`.

### Section library (choose what the product needs, in this order)
1. **Mockup(s)**: the views the product needs, each with a cyan view label:
   - Front / Back are standard. Add Side / Top for 3D products.
   - Packaging uses Closed Box / Opened Box / Opened Lid / Top Lid Inside.
   - Overall dimensions go on the mockup in red.
   - Callouts are thin cyan leader lines with black or cyan text; arrowheads are optional.
     Keep each label short ("Battery Slot", "Metal Snap fit 0.9cm Dia", "EVA Foam (White)").
   - Product colour chip goes bottom-right: "Product Color / PMS: 219 C".
   - For construction details (seams, stitching), put a photo inset beside the view with a callout.
2. **Logo Placement** (**every product, every category**, decided by the user 2026-11-17): a flat vector line
   drawing of the product with the logos on it, so the factory sees exactly where each logo sits.
   - Draw the product yourself with `ynPath` / `ynRect` (black 0.75 pt outline, flat fills in the product colours:
     body, lid, base, strap …). Never use an image trace of the photo.
   - One view per print location (Front | Back, Left | Right sleeve, Lid …), each with a cyan view label, in the
     same order as the Mockup views.
   - Place the vector logos at their confirmed size and offsets. Draw 1:1 when the product fits the sheet
     width, otherwise scale everything together and add the note "Not to scale".
   - Mark each imprint area with `ynImprintArea(logo)` (dotted cyan box), plus the legend
     "Dotted line = Imprint Area (Do not Print)".
   - Header: `Logo Placement`. To add it to a built sheet, make room with `ynShiftBelow(y, dy)`.
3. **Technical drawing** (3D/moulded products): orthographic CAD views with dimension lines.
   Every value carries units in inches **and** cm. The team's fidget-charm drawing had bare numbers
   such as "2.6" or "R.3"; don't copy that.
4. **Artwork 1:1**: one panel per print location, or Front | Back.
   - Art is at true size, with red dimension lines (width below, height left).
   - PMS chips: a square plus "PMS: 143 C".
     - When there are many colours, run a leader line from each chip to its area (coin).
     - For a gradient, show the gradient bar with a red tick down to a chip for each stop, and add
       "(Gradient similar to this pantone code)" when the match is approximate.
   - A placement note goes under the art, in body text or red: centre, offset from edge,
     "must not wrap onto the sides".
   - Legibility warnings where they apply: "Note: The fine details in the logo might not be legible
     in the final print." / "The TM mark may not be legible in the final print."
   - Mark the finish on the art: Soft Enamel, Solid raised metal, UV print on top, Laser Engraving,
     Polished Shiny metal finish, Embossed UV.
5. **Variants grid** (one product, many versions, e.g. the coin's 1600–3500 days): a cell per variant,
   each with header `<Variant> Artwork 1:1` and its own dimensions. Above the grid, a red note on
   which artwork applies to which variant.
6. **Dieline / flat artwork** (boxes, tags, cards): the flat layout at 1:1, with panel dimensions
   along the bottom edge and a line legend. The team's colours vary between sheets; use this one standard:
   - **Boxes:** Die-cut line = yellow, Fold line = red, Bleed line = green, each labelled "(Do not Print)".
   - **Flat stickers / tags / cards:** red **dashed** "Die cut line (Do not Print)". Art bleeds ~0.125" past it.
   - **Sewn items:** dashed "Stitch Line (Do not Print)". Coasters: green print area + red bleed area.
   - One convention per sheet, always with a legend. Box construction details are in `references/product-types.md`.
   **No open view / dieline supplied → Claude makes both:**
   - Box style decides the layout: reverse/straight tuck end, two-piece rigid (lid + base),
     mailer, sleeve, magnetic flap. Ask only if it isn't visible in the mockup.
   - Dieline from L × W × H (inner) + board thickness: panels in order (side–front–side–back +
     glue flap ~0.5"), tuck flaps, dust flaps; bleed 0.125" (3 mm) outside trim.
   - Place the mockup's artwork onto the right panels (front, back, sides, top, bottom); made-in
     line and UPC on back or bottom.
   - Dimension every panel in red (inches with cm in brackets) and add an **Opened Box** view
     beside the Closed Box mockup.
   - Note on the sheet: "Dieline for reference — confirm with factory die before printing."
   - **Generator** (`yn_box.jsx`): a `dieline` section in spec.json (`box: "tuck"`, dims `[W front, D side, H height]`,
     opts `{hangTab, glue, tuck, straight}`; or `box: "mailer"`, dims `[L, W, H]`) draws the cut outline, folds,
     bleed, panel dims and legend, and places art per panel (`art: {Front: file, Top: file, Lid: file, ...}`; lid and
     back art are rotated 180° automatically). By hand: `ynTuckEnd`/`ynMailer` return the panels for `ynPanelArt`.
     Other constructions (rigid, sleeve, drawer, tube) are still drawn by hand with `ynPath`/`ynLine`.
7. **Size chart** (apparel): a table titled "(All sizes are listed in inches)". Add cm (SOP), plus a
   tolerance line and a **Features** bullet list.
8. **Child parts / accessories**: one panel each, e.g. clasp, snap, USB cable, manual front cover,
   EVA foam, satin ribbon. Give the material in brackets and dimensions as `~35 mm (1.38 in)`.
9. **Labels & stickers**: each at 1:1 with red dimensions, then Material / Location / Note lines.
   - Woven or satin labels: Front | Back plus a dotted stitch line. Wash care needs one label per size.
   - Warning sticker: e.g. choking hazard, size 1" x 0.4", paper, "stick on back of every piece".
   - Made-in artwork when it is printed separately, e.g. on the box bottom.
10. **Product features table** (electronics): two cyan column headers, Product Features | Description,
   with the feature in bold and the description in regular.
11. **Reference images**: "Experience Images", "<Product> Reference Images", "Packaging Reference
    Images". Use photo grids of the user's images. Add a disclaimer when needed: "*Image shown is for
    bulk carton packaging reference only."
12. **Specs**: a cyan header, then `Key: Value` lines (keys bold, as on the projector sheet).
    Typical keys:
    - Product, Client, Category/Model, Colour, Size/Dimensions, Thickness, Weight
    - Material: for multi-layer products, one indented line per layer
    - Imprint Method per location or side, Finish
    - Packaging method: each pc in poly/OPP/PLA bag, shrink wrap or cling film
    - Packing: inner case qty, master carton qty, total
    - Package includes (1 x …)

**Packaging placement depends on the packaging** (user's decision, 2026-11-17):
- Simple packaging (polybag, OPP bag, made-in or warning sticker, belly band, hang tag) goes in a section on the product sheet.
- A **custom printed box** (tuck, mailer, rigid/magnetic, drawer + sleeve, tube) gets its **own spec file** with the
  same OPP, as with 10694 clock + 10694 box. Title it `<OPP> - <CLIENT> - <Project> - Packaging Box`.
A retail box's back panel usually carries:
- feature icons with labels
- Product Name, Material, Max voltage, Product Dimensions, Packing Dimensions, Weight
- Package Includes
- CAUTION text
- MADE IN … and CE / FCC / RoHS marks, when the user confirms they apply

**Presentation boards** ("Educate sheet") are a different deliverable: a landscape one-pager with
product renders and red arrows to name + size labels. Build one only when asked.

### Styles (measured from the PDFs)
| Use | Font | Size | Colour |
|---|---|---|---|
| Title | Arial Bold | ~23 pt | #231F20 |
| "Specs" + section headers | same family, Bold | 15–23 pt | cyan #00AEEF |
| View labels, imprint method line | Bold | ~12 pt | #00AEEF |
| Body / specs / tables | Arial Regular | 9–11 pt | #231F20 |
| Dimension lines + text | Regular | 8 pt | red #ED1C24 lines, black #231F20 numbers (team majority) |
| Critical notes | Regular | 9–11 pt | red #ED1C24 |
| Callout leaders | thin line | — | cyan #00AEEF |
| Made-in line | Arial Regular | 6–7 pt | black |
Font: **Arial only** (Arial Bold / Arial Regular), decided by the user. Don't use Myriad Pro even though older sheets do.

### Mistakes found in the team's sheets (check for these every time)
- Dimension text mismatched between sections: clock box back panel says product 7.2×1.7×3.5" while
  the spec says 7.2×2.95"; fidget drawing says 2.6×3.4 while the spec says 3.14×2.36.
- Unit marks wrong or missing: `0.6'` (feet) instead of `0.6"`, `2.25 (5.73cm)` with no `"`,
  `0.37" x 0.75` with no unit, CAD numbers with no units.
- Imprint colour count doesn't match the logo's PMS count (COSTA 2C vs 5 PMS).
- Contradictory materials ("Elastic hanging rope" vs "Black braided polyester cord" on the hang tag).
- Typos: Alaram, Taeta, Gradiant, shrik, Stiker.
- Duplicate PMS chips (273C listed twice on the coin).
- MADE IN line missing on product sheets, or missing "BY Y-NOT.COM".

Found across the 155 training sheets (the same errors keep recurring):
- **cm conversions truncated or wrong**: 1.25" → 3.17 (correct 3.18), 6" → 15.44 (15.24), 1.7" → 4.5 (4.32),
  2.71" → 6.07 (6.88), and values reverse-converted from cm such as 11.81" (29.99 cm). Always compute cm from inches with `ynIn()`.
- **Stale copied values**: 32 oz sheet carrying the 24 oz dims; 9 names of different lengths all "2.68""; a cloned
  template keeping old numbers. Re-measure every value; never copy one from another sheet.
- **Colour count vs chips**: "Full Color/4C" with 2–7 spot chips; "1 Color" with 2 chips; "7-color" with 6 chips.
  No colour count stated, underbase never mentioned.
- **Fake PMS**: "PMS: Navy Blue", "PMS: Grey Steel". Write `Color: Navy Blue (vendor colour)` or a real code.
  PMS codes without C/U ("PMS 4153"), duplicate chips, chip label different from the swatch.
- **Placeholders left in**: "TBD", "[Specify name]", "_ Pieces per case", empty "Imprint Method:", hidden text frames.
- **Contradictions inside one sheet**: label fibre vs garment fibre, 1" on mockup vs "1 cm" in note, aluminium vs steel,
  embroidery note on a sublimation item, sublimation on 100% cotton, box shorter than the product, laser logo in colour.
- **Dimension orders and units**: H/D or L/H swapped, `''` as an inch mark, "Cm", missing `(`, inch-only Specs lines.
- **Other clients' products in reference photos** (another brand's stickers, an HP keychain). Never use them.
- More typos: Refrence, Nickle, Polyster, Starp, Thikness, Transperent, Mannual, Jurnal, Embosed, Diffucer, then→than.

## SOP rules (enforce every time)
- Every dimension, everywhere (mockups, CAD drawings, size charts, labels, specs text): inches first, cm in brackets: `2.25" (5.72 cm)`. 1 in = 2.54 cm, 2 decimals. Size charts: inch value with cm in brackets in each cell, or a cm row under each inch row.
- Every printed colour has a Pantone code; CMYK only when no Pantone exists. Follow client brand guidelines.
- State imprint colour count (1C / 4C / full colour) for every printable part, and underbase if dark garment.
- Callouts are blue arrows + text.
- Material and finish are always stated.
- Made-in: **ask on every job** (user's decision, 2026-11-17). If the user's info doesn't settle it, ask
  "Made-in label/sticker needed?" as a step-5 dialog question. Team practice: custom or China-sourced items get it; decorated retail blanks (Sport-Tek, Yeti …)
  usually don't. Mention that as the suggested default. When it's needed, use the label or sticker specs in
  `references/product-types.md`.
- Compliance labels only with content the user/QC provided.
- Barcode: only with a UPC the user gives; generate as vector, show its size (e.g. 1.5 × 1 in).
- Spell-check every text frame before saving.

## QC checklist (Design Team PO Checklist — report each as ✅ / ❌ / n/a)
1. Global or local sourcing stated
2. Repeat order? previous inspection report + latest artwork checked
3. All sourcing info collected
4. All sales info collected
5. Correct logo + brand guidelines used
6. Material spec + assembly details present
7. File named correctly with version
8. Callouts + dimensions for production present
9. Correct PMS codes and dimensions on every logo
10. Compliance requirements included
11. Packaging details included
12. UPC included (if required)
13. MADE IN … present
14. Proofread (spelling + info consistency, e.g. colour counts match the logos)
15. BOM sheet attached (if child parts)

## Helper library (`scripts/yn_lib.jsx`, tested on Illustrator 30.8 by rebuilding COSTA)
Loaded through `include` (see "Running scripts"). All values are in **inches, measured from the top-left, with y growing down**.
- `ynBuildSheet(sheet, jobDir)`, `ynRead(path)`: whole sheet from spec.json (`yn_sheet.jsx` documents the format)
- `ynQC({opp})`, `ynLogoColors(item)`: see steps 8 and 4
- `ynTuckEnd(x,y,W,D,H,opts)`, `ynMailer(x,y,L,W,H,opts)`, `ynDielineDims(box)`, `ynDielineLegend(x,y)`, `ynPanelArt(panel,file)`
- `ynInit(w,h)`, `ynSetHeight(h)`, `ynLayer(name)`
- `ynText(layer,str,x,y,size,bold,color,'L|C|R')`, `ynPara(...)` (wrapping text), `ynSpecs(layer,[[key,val],[]...],x,y,size,maxW)` (keys bold; maxW wraps long values)
- `ynSection(x,y,w,h,title,sub)`: bordered box, cyan header, `(sub)` line
- `ynDim(x,y,len,'H|V',valueIn)`: red dimension line labelled `2.25" (5.72 cm)` (`ynIn(v)` formats any value)
- `ynCallout(tx,ty,lx,ly,text)`: cyan leader with a dot on the target
- `ynChip(x,y,color,'143 C')`, `ynSpot(name)`, `ynAddSpot(name,{l,a,b})`
- `ynTable(layer,x,y,colW[],rowH,rows)`, `ynRect`, `ynLine`
- `ynPath(layer,pts,closed,fill,stroke)`: bezier paths for flat product drawings; `ynImprintArea(item,pad)`: dotted cyan imprint box;
  `ynShiftBelow(y,dy)`: push everything below y down to insert a section
- `ynPlace(layer,path,x,y,maxW,maxH)`: images are embedded; .ai/.svg/.eps/.pdf stay vector. It fits the box and keeps the aspect ratio.
- `ynScaleToWidth(item,w)`, `ynSize(item)`, `ynPos(item)`: they measure the clipped (visible) area, so dimensions are true sizes
- `ynExportPNG(path,scale)`, `ynSave(ai,pdf)`
Close only documents you created. Never close the user's documents.

## Illustrator notes (ExtendScript)
- Units are points: 1 in = 72 pt. Illustrator y-axis goes **up** (top of artboard = highest y);
  `pathItems.rectangle(top, left, width, height)`.
- New doc: `app.documents.add(DocumentColorSpace.CMYK, w, h)`.
- Named layers: Header, Mockup, Callouts, Logo Artwork, Dimensions, Size Chart, Specs, Labels.
- Spot colours: use the Pantone swatches that came from the logo file or from Pantone Connect, with
  their official values. Keep the names exactly as they are (`PANTONE 143 C`). Use them on chips and
  logos. Illustrator 2026 has no built-in Pantone books, so never create Pantone swatches from
  remembered values.
- Vector logos: `doc.groupItems.createFromFile(new File(path))` keeps them editable. Scale to the
  confirmed imprint size (keep aspect). Rasters/photos: `placedItems.add()` then `.embed()`.
- Text: `textFrames.add()`, set `textRange.characterAttributes.textFont = app.textFonts.getByName("ArialMT")`
  (`"Arial-BoldMT"` for bold), size, fillColor. Set tracking 0 explicitly.
- Arrows: a 2-point `pathItems` line + small filled triangle; group them.
- Preview: the `preview` tool (or `ynExportPNG(path, scale)` to keep a PNG in the job folder).
- Never chain `a ? b : c ? d : e`: ExtendScript groups it wrongly. Use an object lookup or if/else.
- ES3 reserved words can't be names: `short`, `int`, `char`, `byte`, `float`, `long`, `double`, `final`, `native`, `package`, `goto`.
- `$.evalFile` inside a function makes the loaded file's functions local to that function: load at top level.
- Save: `doc.saveAs(new File(ai), new IllustratorSaveOptions())`, PDF with `PDFSaveOptions`
  (`preserveEditability = true`).
