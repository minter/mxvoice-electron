## DOM Utilities Module

Vanilla JavaScript replacements for jQuery DOM manipulation. Provides jQuery-like syntax for easy migration.

### Structure
```
dom-utils/
├── index.js   # Selector functions and DOM manipulation utilities
└── README.md
```

### Exports

- `$` — Single element selector (like `document.querySelector`)
- `$$` — Multiple element selector (like `document.querySelectorAll`)
- `domUtils` — Object with DOM manipulation helpers:
  - `text(element, text?)` — Get/set text content
  - `html(element, html?)` — Get/set inner HTML
  - `val(element, value?)` — Get/set form element value
  - `addClass/removeClass/toggleClass/hasClass` — CSS class manipulation
  - `show/hide/toggle` — Element visibility
  - `attr/removeAttr/data` — Attribute management
  - `on/off/trigger` — Event handling
  - `append/prepend/remove/empty` — DOM manipulation
  - `css/prop` — Style and property access
- `Dom` — Default export combining `$`, `$$`, and all `domUtils` methods

### Usage

```javascript
import Dom from '../dom-utils/index.js';

Dom.text('#status', 'Ready');
Dom.addClass('#panel', 'active');
Dom.on('#button', 'click', handler);
```
