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
- **Mode toggle buttons** (`.mode-toggle`) are responsive and automatically hide text labels on smaller screens while maintaining icon visibility and hover tooltips.

### Responsive Design
- **Mode toggle buttons** (`.mode-toggle`): Automatically adapt from text+icon to icon-only mode based on screen width while maintaining horizontal layout
- **Breakpoints**: 
  - 1400px: Text labels hidden, icons remain with tooltips (prevents misalignment)
  - 1200px: Optimized spacing and touch targets
  - 1000px: Minimal spacing for extremely narrow columns
- **Icon bars** (`.icon-bar`): Adjust spacing and icon sizes for different screen sizes
- **Tooltips**: All tooltips use Bootstrap with centrally configured delay via CSS custom properties (`--tooltip-delay: 1000ms`) for easy global modification

### Import order
1. Variables/tokens (`colors.css`)
2. Fonts (`fonts.css`)
3. Base/normalize (if any)
4. Components/layout (in `index.css`)

### Adding styles
- For new font files, add `@font-face` in `fonts.css`
- For new color tokens, add to `colors.css` and reference via `var(--token-name)`
- Keep `index.css` as the orchestrator; avoid duplicating variable definitions

### Tooltip Configuration
- **Global delay**: Modify `--tooltip-delay` in `:root` to change all tooltip delays at once
- **Current setting**: `--tooltip-delay: 1000ms` (1 second)
- **Examples**: 
  - `500ms` for faster tooltips
  - `2000ms` for slower tooltips
  - `0ms` for instant tooltips
- **No HTML changes needed**: The JavaScript automatically reads the CSS variable and applies it to all tooltips

