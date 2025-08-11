## Bootstrap 4 → 5 Migration Plan

### Goals
- **Upgrade** from Bootstrap 4.6 to Bootstrap 5.x using the bundle (Popper v2 included)
- **Remove reliance on jQuery-based Bootstrap plugins** while keeping jQuery for non-Bootstrap usages
- **Preserve UI/UX** and component behavior (modals, tabs, tooltips, forms)
- **Respect context isolation**: DOM interactions stay in renderer; preload/main communicate via IPC

### Current state (inventory)
- **Dependencies**: `bootstrap@^4.6.0`, `jquery@^3.6.0`, `popper.js@^1.x`
- **Includes** in `src/index.html`:
  - CSS: `../node_modules/bootstrap/dist/css/bootstrap.min.css`
  - JS: `../node_modules/bootstrap/dist/js/bootstrap.min.js`
  - jQuery and Popper v1 loaded before Bootstrap
- **jQuery Bootstrap plugins used** in renderer code:
  - Modals: `$("#...Modal").modal()`, `modal("hide")`
  - Tabs: `$().tab("show")`
  - Global hide: `$(".modal").modal("hide")`
- **Data attributes and markup (Bootstrap 4)**:
  - `data-toggle`, `data-target`, `data-dismiss`
  - `.close` buttons in `.modal-header`
  - `.no-gutters` on rows
  - `.custom-select`, `.custom-range`
  - `.input-group-prepend` / `.input-group-append`
  - Frequent `.form-group` blocks

### Phase 0: Branch and inventory
Status: Completed
- Work on `bootstrap5` branch
- Track all Bootstrap 4 usages with project-wide searches:
  - Attributes: `data-toggle`, `data-target`, `data-dismiss`
  - jQuery plugin calls: `.modal(`, `.tab(`
  - Markup: `no-gutters`, `custom-select`, `custom-range`, `input-group-prepend|append`, `form-group`, `.close`, `.sr-only`

### Phase 1: Dependencies and global includes
Status: Completed
- Update dependencies:
  - `yarn add bootstrap@^5.3.3 @popperjs/core@^2`
  - `yarn remove popper.js`
- `src/index.html` changes:
  - Keep Bootstrap CSS path (5.x is still `dist/css/bootstrap.min.css`)
  - Replace JS include with the bundle:
    - `../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js`
  - Ensure jQuery remains before Bootstrap (jQuery is still used by app code, just not by Bootstrap 5)

### Phase 2: Markup and data attributes
Status: Completed
- Replace attributes (HTML):
  - `data-toggle` → `data-bs-toggle`
  - `data-target` → `data-bs-target`
  - `data-dismiss` → `data-bs-dismiss`
- Replace components/classes:
  - Modal close: `.close` + `&times;` → `.btn-close` (no inner text)
  - Gutterless rows: `.no-gutters` → `g-0` on the `.row`
  - Screen-reader only: `.sr-only` → `.visually-hidden`
  - Selects: `.custom-select` → `.form-select` (use `.form-select-sm` where needed)
  - Range inputs: `.custom-range` → `.form-range`
  - Input groups: remove `.input-group-prepend`/`.input-group-append`; make children direct descendants of `.input-group` (use `.input-group-text` for text adornments)
  - Optional: gradually replace `.form-group` with spacing utilities (`mb-3`) and grid (`row g-2`), only if required for layout

### Phase 3: JS API migration off jQuery plugins
Status: Completed
Bootstrap 5 drops the jQuery plugin API. Replace usages with the Bootstrap 5 JS API via a small adapter.

- Add `src/renderer/modules/ui/bootstrap-adapter.js`:
  - `showModal(selector)` / `hideModal(selector)` using `bootstrap.Modal.getOrCreateInstance`
  - `hideAllModals()` iterating `.modal.show`
  - `showTab(selector)` using `bootstrap.Tab.getOrCreateInstance(...).show()`
  - `initTooltip(selector)` for `[data-bs-toggle="tooltip"]`
- Replace call sites incrementally:
  - `$("#songFormModal").modal()` → `showModal("#songFormModal")`
  - `$("#songFormModal").modal("hide")` → `hideModal("#songFormModal")`
  - `$(".modal").modal("hide")` → `hideAllModals()`
  - ``$(`#hotkey_tabs li:nth-child(${tab}) a`).tab("show")`` → `showTab(`#hotkey_tabs li:nth-child(${tab}) a`)`
  - Initialize tooltips during UI bootstrap: `initTooltip('[data-bs-toggle="tooltip"]')`
- Files to touch first:
  - `src/renderer/modules/utils/modal-utils.js`
  - `src/renderer/modules/ui/modals.js`
  - `src/renderer/modules/song-management/song-crud.js`
  - `src/renderer/modules/hotkeys/hotkey-ui.js`
  - `src/renderer/modules/event-coordination/dom-initialization.js`
  - `src/renderer/modules/preferences/{preference-manager.js,settings-controller.js}`
  - Replace preload DOM call (`src/preload/modules/ipc-bridge.js` → emit IPC that renderer handles to open modal)

### Phase 4: Optional temporary jQuery shim
Status: Completed (not needed)
If you want a minimal-diff first step:
- Provide a jQuery bridge that defines `$.fn.modal` and `$.fn.tab` using Bootstrap 5’s classes
- Load once in renderer to keep old calls working temporarily
- Remove shim after migrating to the adapter

### Phase 5: Validate styles and layout
Status: In Progress
- Verify and adjust:
  - `.form-group` spacing vs. utilities (`mb-*`) where necessary
  - Input group structure after removing `-prepend/-append`
  - `.form-select` sizing (`.form-select-sm`) to match old appearance
  - `.btn-close` alignment inside `.modal-header`
  - `.g-0` replacing `.no-gutters` in tight rows
  - Progress bar and tooltip initialization

### Phase 6: Documentation updates
- Update READMEs affected by API/markup changes to show:
  - Adapter usage instead of jQuery plugin calls
  - Updated attribute names (`data-bs-*`) and classes
  - Any preload/main IPC changes related to opening modals

### Phase 7: QA and release
- Manual QA:
  - All modals: Add/Edit Song, Categories, Bulk Add, Preferences, First Run, New Release, Confirmation, Input
  - Tabs switch correctly (Holding Tank, Hotkeys)
  - Tooltip shows on progress bar
  - Search input group layout and actions
  - Volume slider (`.form-range`) behavior
- Build and smoke-test on macOS; validate Windows/Linux packages as applicable

### Concrete to-dos by file
- `package.json` / `yarn.lock`
  - Add `bootstrap@^5.3.3`, `@popperjs/core@^2`; remove `popper.js`
- `src/index.html`
  - Switch to `bootstrap.bundle.min.js`
  - Rename `data-*` attributes to `data-bs-*` (tabs, tooltips, modal dismiss)
  - Replace `.close` buttons with `.btn-close`
  - Replace `.no-gutters` with `g-0`
  - Replace `.custom-select` → `.form-select`; `.custom-range` → `.form-range`
  - Remove `input-group-prepend/-append` wrappers and adjust markup
- Renderer modules
  - Add `modules/ui/bootstrap-adapter.js`
  - Replace jQuery plugin calls in:
    - `modules/utils/modal-utils.js`
    - `modules/ui/modals.js`
    - `modules/song-management/song-crud.js`
    - `modules/hotkeys/hotkey-ui.js`
    - `modules/event-coordination/dom-initialization.js`
    - `modules/preferences/*`
- Preload
  - Replace direct modal invocation with an IPC event the renderer handles

### Rollout sequencing
1. Update deps and `index.html` JS to `bootstrap.bundle.min.js`
2. Option A: add temporary jQuery shim to avoid immediate breakage
3. Implement adapter and migrate high-traffic modal/tab call sites
4. Convert markup attributes/classes and input-group structure
5. QA and refine styles; remove shim if used
6. Update documentation and ship

### Notes
- Bootstrap 5 has no jQuery dependency; keeping jQuery for app DOM utilities is fine
- Avoid direct DOM manipulation in preload; use IPC to renderer (context isolation)
- Keep module READMEs accurate when exported APIs or usage examples change


