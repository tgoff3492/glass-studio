# Roadmap

Scope: stained and fused glass. Social features are parked for later.

```mermaid
flowchart TD
  F["Phase 0 · Foundation"] --> G["Phase 1 · Glass inventory"]
  G --> S["Phase 2 · Supplies & shopping"]
  G --> P["Phase 3 · Projects"]
  S --> P
  P --> K["Phase 4 · Kiln log"]
  G --> C["Phase 5 · Costing & sales"]
  S --> C
  P --> C
  K --> C
  C --> X["Phase 6 · Smart extras"]
  X -.-> L["Later · Social"]
```

Arrows mean "needs data from."

## Phase 0 · Foundation
- App shell with simple navigation: Glass, Supplies, Projects, Kiln
- Sign-in and cloud backup
- Photo storage for sheets, patterns and finished pieces
- Data model for glass, supplies, projects and firings
- Large text and big tap targets by default; phone and tablet first

## Phase 1 · Glass inventory (first release)
- Sheet glass: manufacturer, color name, product code, COE (90/96), type (cathedral, opalescent, streaky, wispy, iridized, textured), size on hand
- Frit, powder, stringers, noodles, confetti tracked by weight
- Scrap bin for offcuts by color and rough size
- Photo per sheet, plus a "how it looks fired" photo for fused glass
- Search and filter by color family, manufacturer, COE and type

## Phase 2 · Supplies & shopping
- Stained: copper foil (by width), solder (60/40, 50/50, lead-free), lead came, flux, patina, grinder bits, cutter oil
- Fused: kiln wash, fiber paper, shelf paper, molds, dichroic
- Low-stock alerts with a per-item minimum
- Shopping list built from low stock and wish-list colors
- Cost per unit

## Phase 3 · Projects
- Project card: name, type (stained/fused), pattern image, progress photos
- Pull glass from inventory with automatic deduction
- COE compatibility warning for fused pieces
- Status: idea → cutting → foiling/assembling → firing → finishing → done
- Optional time tracking

## Phase 4 · Kiln log
- Schedule library: full fuse, tack fuse, contour, slump, drape, fire polish
- Segments: rate (°F/hr), target temperature, hold time
- Firing log linked to a project, with before/after photos and notes
- Annealing guidance by thickness and COE
- Copy a past firing as a starting point

## Phase 5 · Costing & sales
- Cost per piece from glass, supplies and firings
- Pricing helper with markup and hourly rate
- Finished pieces: at home, on consignment, at a show, sold
- Sales log and monthly totals

## Phase 6 · Smart extras
- Scan a label or product code to add glass
- "What can I make with my scrap?" suggestions
- Find a color by photo
- Export to spreadsheet

## Later
- Social sharing, advice and community
- Destash marketplace
