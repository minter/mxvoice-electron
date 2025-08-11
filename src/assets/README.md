## Assets

Static application assets used by the renderer and packaging.

### Structure
```
assets/
├── fonts/    # Embedded fonts
├── icons/    # App icons (.icns/.ico/.png), DMG artwork
├── images/   # General images (PNG/SVG)
└── music/    # Bundled demo/sample audio
```

### Conventions
- Prefer SVG for vector artwork; use PNG for raster or when SVG is not available
- Optimize images before committing (lossless where possible)
- Keep filenames lowercase with hyphens; no spaces
- Large binaries (>10MB) should not be committed unless essential

### Fonts
- `fonts/` contains JetBrains Mono (Regular/SemiBold) used by the UI
- Reference via `@font-face` in `stylesheets/fonts.css`
- Ensure licensing and attribution are compatible with project terms

### Referencing assets
- From `src/index.html` and renderer modules, use paths relative to `src/`:
  - HTML: `<img src="./assets/images/example.png" />`
  - CSS: `background-image: url('../assets/images/example.png');`

### Adding new assets
1. Place files in the appropriate subdirectory
2. For fonts, add `@font-face` entries in `stylesheets/fonts.css`
3. For new icons, export required sizes (macOS `.icns`, Windows `.ico`, PNG as needed)
4. Update references in HTML/CSS/JS accordingly

