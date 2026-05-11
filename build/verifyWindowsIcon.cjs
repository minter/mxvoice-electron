// build/verifyWindowsIcon.cjs
// Verify that built Windows artifacts contain the full RT_ICON set from our
// source .ico file. Catches regressions where rcedit silently fails to stamp
// the icon, or where build config changes drop signAndEditExecutable, etc.
//
// Runs after electron-builder produces dist/. Pure Node — works on any host
// platform (we run Windows builds from macOS/Linux too).
//
// Exits non-zero if any verified exe is missing the expected icon entries.
const fs = require('fs');
const path = require('path');

const SOURCE_ICO = path.join(__dirname, '..', 'src', 'assets', 'icons', 'mxvoice.ico');
const DIST_DIR = path.join(__dirname, '..', 'dist');

function parseIcoEntries(buffer) {
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);
  if (reserved !== 0 || type !== 1) {
    throw new Error(`Not a valid ICO (reserved=${reserved} type=${type})`);
  }
  const entries = [];
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    const w = buffer.readUInt8(off) || 256;
    const h = buffer.readUInt8(off + 1) || 256;
    const bpp = buffer.readUInt16LE(off + 6);
    const size = buffer.readUInt32LE(off + 8);
    entries.push({ w, h, bpp, size });
  }
  return entries;
}

function readSourceExpectations() {
  const data = fs.readFileSync(SOURCE_ICO);
  return parseIcoEntries(data).map(({ w, h, size }) => ({ w, h, size }));
}

// Minimal PE resource walker: returns RT_GROUP_ICON entries as parsed dirs.
function extractGroupIcons(exePath) {
  const fd = fs.openSync(exePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const buf = Buffer.alloc(stat.size);
    fs.readSync(fd, buf, 0, stat.size, 0);

    const peOffset = buf.readUInt32LE(0x3c);
    if (buf.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
      throw new Error('Not a PE file');
    }
    const coffOffset = peOffset + 4;
    const numSections = buf.readUInt16LE(coffOffset + 2);
    const optHeaderSize = buf.readUInt16LE(coffOffset + 16);
    const optHeaderOffset = coffOffset + 20;
    const magic = buf.readUInt16LE(optHeaderOffset);
    const isPE32Plus = magic === 0x20b;

    // Resource directory entry in DataDirectory[2]
    const dataDirOffset = optHeaderOffset + (isPE32Plus ? 112 : 96);
    const rsrcRVA = buf.readUInt32LE(dataDirOffset + 2 * 8);
    if (rsrcRVA === 0) throw new Error('No resource directory');

    // Build section table to map RVA -> file offset
    const sectionTableOffset = optHeaderOffset + optHeaderSize;
    const sections = [];
    for (let i = 0; i < numSections; i++) {
      const so = sectionTableOffset + i * 40;
      sections.push({
        virtAddr: buf.readUInt32LE(so + 12),
        virtSize: buf.readUInt32LE(so + 8),
        rawOffset: buf.readUInt32LE(so + 20),
        rawSize: buf.readUInt32LE(so + 16),
      });
    }
    const rvaToOffset = (rva) => {
      for (const s of sections) {
        if (rva >= s.virtAddr && rva < s.virtAddr + Math.max(s.virtSize, s.rawSize)) {
          return s.rawOffset + (rva - s.virtAddr);
        }
      }
      throw new Error(`RVA 0x${rva.toString(16)} not in any section`);
    };

    const rsrcOffset = rvaToOffset(rsrcRVA);
    const rsrcSection = sections.find(
      (s) => rsrcRVA >= s.virtAddr && rsrcRVA < s.virtAddr + Math.max(s.virtSize, s.rawSize)
    );

    function walkDir(dirOff, depth, typeId) {
      const numNamed = buf.readUInt16LE(dirOff + 12);
      const numId = buf.readUInt16LE(dirOff + 14);
      const total = numNamed + numId;
      const out = [];
      for (let i = 0; i < total; i++) {
        const eOff = dirOff + 16 + i * 8;
        const nameOrId = buf.readUInt32LE(eOff);
        const offsetToData = buf.readUInt32LE(eOff + 4);
        const isDir = (offsetToData & 0x80000000) !== 0;
        const childOff = rsrcOffset + (offsetToData & 0x7fffffff);

        const id = nameOrId & 0x7fffffff; // for ID entries, top bit is 0; just use as-is
        const isNamed = (nameOrId & 0x80000000) !== 0;

        if (depth === 0) {
          // Type level: only walk RT_GROUP_ICON (14)
          if (!isNamed && id === 14 && isDir) {
            out.push(...walkDir(childOff, 1, 14));
          }
        } else if (depth === 1) {
          // Name/ID level
          if (isDir) out.push(...walkDir(childOff, 2, typeId));
        } else {
          // Language level — leaf
          const dataRVA = buf.readUInt32LE(childOff);
          const dataSize = buf.readUInt32LE(childOff + 4);
          const dataOffset = rvaToOffset(dataRVA);
          out.push(buf.slice(dataOffset, dataOffset + dataSize));
        }
      }
      return out;
    }

    return walkDir(rsrcOffset, 0, null);
  } finally {
    fs.closeSync(fd);
  }
}

function parseGroupIcon(buffer) {
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);
  if (reserved !== 0 || type !== 1) {
    throw new Error(`Invalid GROUP_ICON header reserved=${reserved} type=${type}`);
  }
  const entries = [];
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 14;
    const w = buffer.readUInt8(off) || 256;
    const h = buffer.readUInt8(off + 1) || 256;
    const bpp = buffer.readUInt16LE(off + 6);
    const size = buffer.readUInt32LE(off + 8);
    entries.push({ w, h, bpp, size });
  }
  return entries;
}

function findExesToVerify() {
  if (!fs.existsSync(DIST_DIR)) return [];
  const result = [];

  // Installer exe in dist/
  for (const entry of fs.readdirSync(DIST_DIR)) {
    if (entry.toLowerCase().endsWith('.exe') && entry.toLowerCase().includes('setup')) {
      result.push({ label: 'installer', path: path.join(DIST_DIR, entry) });
    }
  }

  // Main app exe in dist/win-unpacked/
  const unpacked = path.join(DIST_DIR, 'win-unpacked');
  if (fs.existsSync(unpacked)) {
    for (const entry of fs.readdirSync(unpacked)) {
      if (entry.toLowerCase().endsWith('.exe') && !entry.toLowerCase().includes('uninstall')) {
        result.push({ label: 'main app', path: path.join(unpacked, entry) });
      }
    }
  }
  return result;
}

function verify(exePath, expected) {
  const groups = extractGroupIcons(exePath);
  if (groups.length === 0) {
    return { ok: false, reason: 'No RT_GROUP_ICON found' };
  }
  // Use the first (or largest) group
  const group = groups[0];
  const entries = parseGroupIcon(group);

  for (const exp of expected) {
    const match = entries.find((e) => e.w === exp.w && e.h === exp.h && e.size === exp.size);
    if (!match) {
      return {
        ok: false,
        reason: `Missing ${exp.w}x${exp.h} (${exp.size} bytes) in embedded icon — got [${entries
          .map((e) => `${e.w}x${e.h}/${e.size}`)
          .join(', ')}]`,
      };
    }
  }
  return { ok: true };
}

function main() {
  const expected = readSourceExpectations();
  console.log(
    `[verifyWindowsIcon] Source ${SOURCE_ICO} expects ${expected.length} icon entries: ${expected
      .map((e) => `${e.w}x${e.h}`)
      .join(', ')}`
  );

  const exes = findExesToVerify();
  if (exes.length === 0) {
    console.warn('[verifyWindowsIcon] No Windows artifacts found in dist/ — nothing to verify');
    return;
  }

  let failed = 0;
  for (const { label, path: exePath } of exes) {
    process.stdout.write(`[verifyWindowsIcon] ${label}: ${path.basename(exePath)} ... `);
    try {
      const result = verify(exePath, expected);
      if (result.ok) {
        console.log('OK');
      } else {
        console.log(`FAIL — ${result.reason}`);
        failed++;
      }
    } catch (err) {
      console.log(`ERROR — ${err.message}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`[verifyWindowsIcon] ${failed} artifact(s) failed icon verification`);
    process.exit(1);
  }
  console.log(`[verifyWindowsIcon] All ${exes.length} artifact(s) verified`);
}

main();
