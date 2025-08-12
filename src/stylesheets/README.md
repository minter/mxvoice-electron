## Stylesheets

Global styles for the renderer UI.

### Files
- `colors.css`: Color variables and theme tokens
- `fonts.css`: `@font-face` declarations and font stacks
- `index.css`: Main stylesheet; imports base rules and component/layout styles

### Conventions
- Use CSS variables (from `colors.css`) instead of hardcoded values
- Keep typography definitions centralized in `fonts.css`
- Follow BEM-ish naming for complex components: `.block__element--modifier`
- Prefer utility classes for spacing where reasonable

### Layout notes
- Headers (`.card-header`) now allow wrapping. This prevents icon bars in the Holding Tank and Hotkeys columns from clipping on narrow screens.
- `.icon-bar` wraps to multiple rows when space is constrained.
- The main row `#top-row` allows horizontal scrolling if the fixed-width side columns can't shrink further.
- The search column (`#search-column`) flexes to fill all remaining horizontal space.

### Import order
1. Variables/tokens (`colors.css`)
2. Fonts (`fonts.css`)
3. Base/normalize (if any)
4. Components/layout (in `index.css`)

### Adding styles
- For new font files, add `@font-face` in `fonts.css`
- For new color tokens, add to `colors.css` and reference via `var(--token-name)`
- Keep `index.css` as the orchestrator; avoid duplicating variable definitions

