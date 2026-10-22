import { describe, expect, it } from 'vitest';
import { parseLegacyConfigLayout } from '../../../src/main/modules/legacy-config-layout.js';
import { normalizeLayout } from '../../../src/main/modules/show-document.js';

// Builders for the HTML 3.x and 4.0 stored in config.json. 3.x saved
// `$('#hotkeys-column').html()` / `$('#holding-tank-column').html()`; 4.0 saved
// the same columns' innerHTML. Both serialize attributes with double quotes,
// in the order they were set: the static markup's attributes first, then
// `songid` added when a song was assigned.

/** One hotkey row. 3.x also copied songid onto the inner span. */
function hotkeyLi(key, songId, { label = '', v4 = false } = {}) {
  const cls = v4 ? 'list-group-item text-nowrap unselectable context-menu' : 'list-group-item text-nowrap unselectable';
  const liAttr = songId ? ` songid="${songId}"` : '';
  const spanAttr = songId ? ` songid="${songId}"` : '';
  return (
    `<li class="${cls}" id="f${key}_hotkey"${liAttr}>\n` +
    `                        <div class="badge">F${key}</div>\n` +
    `                        <span draggable="true" class="song" ondragstart="songDrag(event)"${spanAttr}>${label}</span>\n` +
    `                      </li>`
  );
}

/** One hotkey tab: `assigned` maps key number to song id. */
function hotkeyTab(tabNumber, assigned = {}, { v4 = false } = {}) {
  const active = tabNumber === 1 ? ' show active' : '';
  const rows = [];
  for (let key = 1; key <= 12; key++) {
    const id = assigned[key];
    rows.push(hotkeyLi(key, id, { label: id ? `Song ${id} by Artist (1:23)` : '', v4 }));
  }
  return (
    `<ul class="list-group list-group-flush tab-pane fade${active} hotkeys" id="hotkeys_list_${tabNumber}" role="tabpanel">\n` +
    rows.join('\n') +
    `\n</ul>`
  );
}

function hotkeysColumn(tabs, { v4 = false } = {}) {
  const header = v4
    ? `<div class="card h-100 rounded-0"><h6 class="card-header rounded-0">Hotkeys<div class="header-button"></div></h6>`
    : `<div class="card h-100 rounded-0"><h6 class="card-header rounded-0">Hotkeys<div class="icon-bar"></div></h6>`;
  const nav = [1, 2, 3, 4, 5]
    .map((n) => `<li class="nav-item"><a class="nav-link${n === 1 ? ' active' : ''}" role="tab" data-toggle="tab" href="#hotkeys_list_${n}">${n}</a></li>`)
    .join('\n');
  return (
    `\n          ${header}\n<ul class="nav nav-tabs nav-fill" id="hotkey_tabs" role="tablist">\n${nav}\n</ul>\n` +
    `<div class="card-body"><div id="hotkey-tab-content" class="tab-content">\n${tabs.join('\n')}\n</div></div></div>\n        `
  );
}

function tankLi(songId, { v4 = false } = {}) {
  const cls = v4 ? 'song list-group-item context-menu' : 'song list-group-item';
  return `<li style="font-size: 11px;" class="${cls}" draggable="true" ondragstart="songDrag(event)" songid="${songId}">Song ${songId} by Artist (2:34)</li>`;
}

function tankTab(tabNumber, songIds = [], opts = {}) {
  const active = tabNumber === 1 ? ' show active' : '';
  return (
    `<ul id="holding_tank_${tabNumber}" class="list-group tab-pane fade${active} holding_tank" role="tabpanel">\n` +
    songIds.map((id) => tankLi(id, opts)).join('') +
    `</ul>`
  );
}

function tankColumn(tabs, { v4 = false } = {}) {
  const header = v4 ? '<div class="mode-toggle"></div>' : '<i title="AutoPlay" id="autoplay_button" class="fas fa-md fa-play-circle"></i>';
  const nav = [1, 2, 3, 4, 5]
    .map((n) => `<li class="nav-item"><a class="nav-link" role="tab" data-toggle="tab" href="#holding_tank_${n}">${n}</a></li>`)
    .join('\n');
  return (
    `\n<div class="h-100 card rounded-0"><h6 class="card-header rounded-0"><span id="holding_tank_label">Holding Tank</span>${header}</h6>\n` +
    `<ul class="nav nav-tabs nav-fill" id="holding_tank_tabs" role="tablist">\n${nav}\n</ul>\n` +
    `<div id="holding_tank" class="card-body table-wrapper-scroll-y my-custom-scrollbar"><div id="holding-tank-tab-content" class="tab-content">\n` +
    `${tabs.join('\n')}\n</div></div></div>\n`
  );
}

const hotkeysOf = (layout) => normalizeLayout(layout).hotkeys.map((t) => t.hotkeys);
const tankOf = (layout) => normalizeLayout(layout).holdingTank.map((t) => t.songIds);

describe('parseLegacyConfigLayout', () => {
  it('reads 3.x hotkeys into tabs 1..5 by key, ignoring the holding tank when it has no songs', () => {
    const config = {
      hotkeys: hotkeysColumn([
        hotkeyTab(1, { 1: '11', 2: '12', 12: '112' }),
        hotkeyTab(2, {}),
        hotkeyTab(3, { 5: '35' }),
        hotkeyTab(4),
        hotkeyTab(5, { 7: '57' })
      ]),
      holding_tank: tankColumn([tankTab(1), tankTab(2), tankTab(3), tankTab(4), tankTab(5)])
    };
    const layout = parseLegacyConfigLayout(config);
    expect(layout).not.toBeNull();
    expect(hotkeysOf(layout)).toEqual([{ f1: '11', f2: '12', f12: '112' }, {}, { f5: '35' }, {}, { f7: '57' }]);
    expect(tankOf(layout)).toEqual([[], [], [], [], []]);
  });

  it('reads a holding tank only, in row order, keeping repeats', () => {
    const config = {
      holding_tank: tankColumn([tankTab(1, ['9', '3', '7']), tankTab(2), tankTab(3, ['3', '3']), tankTab(4), tankTab(5)])
    };
    const layout = parseLegacyConfigLayout(config);
    expect(tankOf(layout)).toEqual([['9', '3', '7'], [], ['3', '3'], [], []]);
    expect(hotkeysOf(layout)).toEqual([{}, {}, {}, {}, {}]);
  });

  it('reads both from the 4.0 markup', () => {
    const config = {
      hotkeys: hotkeysColumn([hotkeyTab(1, { 3: '1003' }, { v4: true }), hotkeyTab(2, { 4: '2004' }, { v4: true })], { v4: true }),
      holding_tank: tankColumn([tankTab(1, ['501'], { v4: true }), tankTab(2, ['502', '503'], { v4: true })], { v4: true })
    };
    const layout = parseLegacyConfigLayout(config);
    expect(hotkeysOf(layout)).toEqual([{ f3: '1003' }, { f4: '2004' }, {}, {}, {}]);
    expect(tankOf(layout)).toEqual([['501'], ['502', '503'], [], [], []]);
  });

  it('uses only the first copy of each tab, as 4.3.2 did (3.x appended clones of tab 1 on every launch)', () => {
    const config = {
      hotkeys: hotkeysColumn([
        hotkeyTab(1, { 1: '1' }),
        hotkeyTab(2, { 2: '2' }),
        hotkeyTab(3),
        hotkeyTab(4),
        hotkeyTab(5),
        // the clones appended on the next launch: copies of tab 1 renamed 2..5
        hotkeyTab(2, { 1: '1' }),
        hotkeyTab(3, { 1: '1' })
      ]),
      holding_tank: tankColumn([tankTab(1, ['8']), tankTab(2), tankTab(2, ['8'])])
    };
    const layout = parseLegacyConfigLayout(config);
    expect(hotkeysOf(layout)).toEqual([{ f1: '1' }, { f2: '2' }, {}, {}, {}]);
    expect(tankOf(layout)).toEqual([['8'], [], [], [], []]);
  });

  it('reads the hotkey row songid, not the span: after a 3.x swap the span can keep a stale id', () => {
    const swapped =
      `<ul class="list-group tab-pane hotkeys" id="hotkeys_list_1" role="tabpanel">` +
      `<li class="list-group-item" id="f1_hotkey"><div class="badge">F1</div><span class="song" songid="77">Old</span></li>` +
      `<li class="list-group-item" id="f2_hotkey" songid="88"><div class="badge">F2</div><span class="song" songid="99">x</span></li>` +
      `</ul>`;
    expect(hotkeysOf(parseLegacyConfigLayout({ hotkeys: swapped }))[0]).toEqual({ f2: '88' });
  });

  it('accepts single-quoted and unquoted attributes and any attribute order', () => {
    const html =
      `<ul role=tabpanel id='hotkeys_list_2'><li songid='5' id=f6_hotkey>a</li></ul>` +
      `<ul id=holding_tank_4><li songid=6>b</li><li data-x="1" songid='7'>c</li></ul>`;
    const layout = parseLegacyConfigLayout({ hotkeys: html, holding_tank: html });
    expect(hotkeysOf(layout)[1]).toEqual({ f6: '5' });
    expect(tankOf(layout)[3]).toEqual(['6', '7']);
  });

  it('reads only digit songids and ignores songs outside a tab', () => {
    const html =
      `<li id="f1_hotkey" songid="4">outside</li>` +
      `<ul id="hotkeys_list_1"><li id="f1_hotkey" songid="abc">x</li><li id="f2_hotkey" songid="">y</li><li id="f3_hotkey" songid="12">z</li></ul>` +
      `<ul id="holding_tank_1"><li songid="1; DROP">x</li><li songid="2">y</li></ul><li songid="3">outside</li>`;
    const layout = parseLegacyConfigLayout({ hotkeys: html, holding_tank: html });
    expect(hotkeysOf(layout)[0]).toEqual({ f3: '12' });
    expect(tankOf(layout)[0]).toEqual(['2']);
  });

  it('ignores markup inside comments and tolerates ">" in attribute values', () => {
    const html =
      `<!-- <ul id="hotkeys_list_1"><li id="f1_hotkey" songid="1"></li></ul> -->` +
      `<ul id="hotkeys_list_1" title="a > b"><li title=">" id="f9_hotkey" songid="9">x</li></ul>`;
    expect(hotkeysOf(parseLegacyConfigLayout({ hotkeys: html }))[0]).toEqual({ f9: '9' });
  });

  it('survives malformed markup: unclosed tabs, stray closers and truncation', () => {
    const html =
      `</ul></li><ul id="hotkeys_list_1"><li id="f1_hotkey" songid="1"><span>` +
      `<ul class="inner"><li id="f2_hotkey" songid="2"></ul>` + // a nested list still belongs to tab 1
      `<li id="f3_hotkey" songid="3`; // tab 1 never closed; truncated mid-attribute
    const layout = parseLegacyConfigLayout({ hotkeys: html, holding_tank: '<ul id="holding_tank_1"><li songid="5">' });
    expect(hotkeysOf(layout)[0]).toEqual({ f1: '1', f2: '2' });
    expect(tankOf(layout)[0]).toEqual(['5']);
  });

  it('handles long unterminated tags in linear-ish time', () => {
    const start = Date.now();
    const junk = `<ul id="hotkeys_list_1"><li id="f1_hotkey" songid="1"></li><li ${'a '.repeat(20000)}${'b'.repeat(20000)}`;
    expect(hotkeysOf(parseLegacyConfigLayout({ hotkeys: junk + ' '.repeat(20000) }))[0]).toEqual({ f1: '1' });
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('ignores tab numbers and keys outside 1..5 and f1..f12', () => {
    const html =
      `<ul id="hotkeys_list_6"><li id="f1_hotkey" songid="1"></li></ul>` +
      `<ul id="hotkeys_list_0"><li id="f1_hotkey" songid="1"></li></ul>` +
      `<ul id="hotkeys_list_1"><li id="f13_hotkey" songid="1"></li><li id="f0_hotkey" songid="1"></li><li id="f12_hotkey" songid="2"></li></ul>`;
    expect(hotkeysOf(parseLegacyConfigLayout({ hotkeys: html }))).toEqual([{ f12: '2' }, {}, {}, {}, {}]);
  });

  it('returns null when neither column has a songid', () => {
    expect(parseLegacyConfigLayout({ hotkeys: hotkeysColumn([hotkeyTab(1)]), holding_tank: tankColumn([tankTab(1)]) })).toBeNull();
    expect(parseLegacyConfigLayout({})).toBeNull();
    expect(parseLegacyConfigLayout({ hotkeys: 42, holding_tank: ['songid="1"'] })).toBeNull();
    expect(parseLegacyConfigLayout(null)).toBeNull();
    expect(parseLegacyConfigLayout('songid="1"')).toBeNull();
  });

  it('returns null when songid appears but no tab yields a usable song', () => {
    expect(parseLegacyConfigLayout({ hotkeys: '<li id="f1_hotkey" songid="1"></li>', holding_tank: '<p songid="x"></p>' })).toBeNull();
  });

  it('returns a layout normalizeLayout keeps unchanged', () => {
    const layout = parseLegacyConfigLayout({ hotkeys: hotkeysColumn([hotkeyTab(1, { 1: '5' })]) });
    expect(normalizeLayout(layout)).toEqual(normalizeLayout(normalizeLayout(layout)));
    expect(normalizeLayout(layout).hotkeys[0]).toEqual({ tabNumber: 1, tabName: null, hotkeys: { f1: '5' } });
  });
});
