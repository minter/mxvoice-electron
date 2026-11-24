# Documentation screenshots

`npm run screenshots` stages the app with a demo library and writes the PNGs
used by the website (mxvoice.app) and its docs. It is not a test suite and is
not part of `npm test`.

```bash
# Into ./screenshots (gitignored), to look at them first
npm run screenshots

# Straight into a checkout of the website
MXVOICE_WEBSITE_DIR=../websites/mxvoice-website npm run screenshots

# Without bringing the app window to the front (macOS)
E2E_BACKGROUND=1 npm run screenshots
```

Files land in `public/docs/` and `src/assets/img/illustrations/` of the
website, under the names its pages already use, so regenerating them needs no
change to the pages.

## How it works

- `demo-library.js` replaces the seeded test library with invented songs,
  categories and shows, so no real library, artist or profile appears in an
  image. Each demo song plays one of the short clips in `tests/fixtures/test-songs`.
- `docs.spec.js` launches the app once at twice the pixel density, in the light
  theme, and stages each image in turn. Add an image by adding a `test` that
  ends in `shoot(...)`.
- The Preferences image shows example paths and the shipped defaults in place
  of the test suite's own values. Nothing else is altered.

## What it can't capture

- Native menus (the Shows menu itself) and open `<select>` dropdowns are drawn
  by the operating system, outside the page.
- The macOS window frame and traffic lights. The whole-window image is the
  page only.
