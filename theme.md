# Flowbase UI Theme

## Direction

Flowbase should feel like a calm, cozy productivity workspace for planning, writing, mapping, and AI-assisted workflows. The visual direction follows a warm cream dashboard with coral primary actions, soft white cards, colorful Lucide icons, and compact navigation.

## Palette

- Background: warm cream `#fbf6ea`
- Sidebar: off-white `#fffaf0`
- Surfaces: clean white `#ffffff`
- Text: near-black ink `#111827`
- Muted text: warm gray `#6b675f`
- Borders: soft warm linen `#e1d8c8`
- Primary accent: coral/red-orange `#ef594a`
- Secondary accents: mint, teal, yellow, violet, sky, rose

Use coral for the logo, active sidebar item, primary buttons, and key activity markers. Use secondary accents for icons, metric chips, whiteboard notes, and small status details.

## Typography

- Use the system sans stack already provided by Next and Tailwind.
- Dashboard page titles can be large and bold, but app panels should stay compact.
- Sidebar labels should be small, sturdy, and easy to scan.
- Sidebar group labels should be uppercase warm gray markers: `HOME`, `WORKSPACE`, and `BUILD`.

## Spacing And Shape

- Sidebar menu rows should be compact, around 40px tall.
- Cards and panels should use 8px radii, soft borders, and subtle shadows.
- Main dashboard spacing should be generous enough to feel calm while keeping information dense.
- Avoid nested card-heavy layouts; use repeated cards for stats and small lists only.

## Interaction Guidelines

- Sidebar must support expanded and icons-only collapsed modes.
- The sidebar search hides when collapsed.
- Collapsed nav items keep accessible labels through `aria-label` or `title`.
- Hover states should be gentle: mint hover for navigation, warm border emphasis for controls.
