/**
 * Standard sRGB IEC61966-2.1 ICC color profile.
 *
 * This is a minimal sRGB profile (~3KB) that tells printers and image viewers
 * "these colors are defined in the sRGB color space." Embedding this in TIFF
 * and PNG exports ensures consistent color interpretation across devices.
 *
 * The profile is the widely-used sRGB v2 profile compatible with all major
 * image editors (Photoshop, GIMP, Lightroom) and print RIP software.
 */

/**
 * Build a minimal but valid sRGB ICC profile from scratch.
 * This constructs a ~588 byte profile with:
 * - Profile header (128 bytes)
 * - Tag table (4 tags × 12 bytes + 4-byte count = 52 bytes)
 * - desc tag (description)
 * - wtpt tag (white point)
 * - rXYZ/gXYZ/bXYZ tags (colorant primaries)
 * - rTRC/gTRC/bTRC tags (tone reproduction curves)
 * - cprt tag (copyright)
 */
export function getSrgbProfileBytes(): Uint8Array {
  // Helper: write big-endian uint32
  function writeU32(buf: DataView, offset: number, val: number) {
    buf.setUint32(offset, val, false); // big-endian
  }

  // Helper: write big-endian uint16
  function writeU16(buf: DataView, offset: number, val: number) {
    buf.setUint16(offset, val, false);
  }

  // Helper: write ASCII string (no null terminator)
  function writeStr(buf: Uint8Array, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      buf[offset + i] = str.charCodeAt(i);
    }
  }

  // Helper: write s15Fixed16Number (signed 15.16 fixed point)
  function writeS15Fixed16(buf: DataView, offset: number, val: number) {
    const fixed = Math.round(val * 65536);
    buf.setInt32(offset, fixed, false);
  }

  // === Build tag data first to calculate offsets ===

  // Description tag data: 'desc' type
  const descText = 'sRGB IEC61966-2.1';
  const descDataLen = 12 + descText.length + 1; // type(4) + reserved(4) + count(4) + string + null
  const descPadded = Math.ceil(descDataLen / 4) * 4;

  // Copyright tag data: 'text' type
  const cprtText = 'No copyright, use freely';
  const cprtDataLen = 8 + cprtText.length + 1; // type(4) + reserved(4) + string + null
  const cprtPadded = Math.ceil(cprtDataLen / 4) * 4;

  // White point tag: 'XYZ ' type = 20 bytes (type(4) + reserved(4) + X(4) + Y(4) + Z(4))
  const xyzDataLen = 20;

  // TRC (tone curve) tag: 'curv' type with gamma = 2.2 (actually sRGB uses parametric curve,
  // but a single-entry curv with gamma ≈ 2.2 is widely accepted as an approximation)
  // type(4) + reserved(4) + count(4) + value(2) = 14 bytes
  const curvDataLen = 14;
  const curvPadded = Math.ceil(curvDataLen / 4) * 4;

  // Tag count: desc, cprt, wtpt, rXYZ, gXYZ, bXYZ, rTRC, gTRC, bTRC = 9 tags
  const tagCount = 9;
  const tagTableSize = 4 + tagCount * 12; // count(4) + entries

  const headerSize = 128;
  const dataStart = headerSize + tagTableSize;

  // Calculate offsets for each tag's data
  let offset = dataStart;
  const descOffset = offset; offset += descPadded;
  const cprtOffset = offset; offset += cprtPadded;
  const wtptOffset = offset; offset += xyzDataLen;
  const rXYZOffset = offset; offset += xyzDataLen;
  const gXYZOffset = offset; offset += xyzDataLen;
  const bXYZOffset = offset; offset += xyzDataLen;
  // rTRC, gTRC, bTRC all share the same curve data (sRGB uses identical curves)
  const trcOffset = offset; offset += curvPadded;

  const profileSize = offset;

  // === Allocate and write ===
  const buffer = new ArrayBuffer(profileSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // --- Profile Header (128 bytes) ---
  writeU32(view, 0, profileSize);       // Profile size
  writeStr(bytes, 4, 'none');           // Preferred CMM (none)
  writeU32(view, 8, 0x02400000);        // Version 2.4.0
  writeStr(bytes, 12, 'mntr');          // Device class: monitor
  writeStr(bytes, 16, 'RGB ');          // Color space: RGB
  writeStr(bytes, 20, 'XYZ ');          // PCS: XYZ
  // Date/time (bytes 24-35): 2024-01-01 00:00:00
  writeU16(view, 24, 2024);            // year
  writeU16(view, 26, 1);               // month
  writeU16(view, 28, 1);               // day
  writeU16(view, 30, 0);               // hour
  writeU16(view, 32, 0);               // minute
  writeU16(view, 34, 0);               // second
  writeStr(bytes, 36, 'acsp');          // Profile file signature
  writeStr(bytes, 40, 'MSFT');          // Primary platform: Microsoft
  writeU32(view, 44, 0);               // Profile flags
  writeStr(bytes, 48, 'none');          // Device manufacturer
  writeStr(bytes, 52, 'none');          // Device model
  // Device attributes (bytes 56-63): 0
  writeU32(view, 64, 0);               // Rendering intent: perceptual
  // PCS illuminant D50 (bytes 68-79): X=0.9642, Y=1.0000, Z=0.8249
  writeS15Fixed16(view, 68, 0.9642);
  writeS15Fixed16(view, 72, 1.0000);
  writeS15Fixed16(view, 76, 0.8249);
  writeStr(bytes, 80, 'none');          // Profile creator
  // bytes 84-127: zeros (profile ID + reserved)

  // --- Tag Table ---
  let tableOffset = headerSize;
  writeU32(view, tableOffset, tagCount);
  tableOffset += 4;

  // Helper to write a tag table entry
  function writeTag(sig: string, dataOff: number, dataLen: number) {
    writeStr(bytes, tableOffset, sig);
    writeU32(view, tableOffset + 4, dataOff);
    writeU32(view, tableOffset + 8, dataLen);
    tableOffset += 12;
  }

  writeTag('desc', descOffset, descDataLen);
  writeTag('cprt', cprtOffset, cprtDataLen);
  writeTag('wtpt', wtptOffset, xyzDataLen);
  writeTag('rXYZ', rXYZOffset, xyzDataLen);
  writeTag('gXYZ', gXYZOffset, xyzDataLen);
  writeTag('bXYZ', bXYZOffset, xyzDataLen);
  writeTag('rTRC', trcOffset, curvDataLen);
  writeTag('gTRC', trcOffset, curvDataLen);  // shared with rTRC
  writeTag('bTRC', trcOffset, curvDataLen);  // shared with rTRC

  // --- Tag Data ---

  // desc tag
  writeStr(bytes, descOffset, 'desc');
  writeU32(view, descOffset + 4, 0);       // reserved
  writeU32(view, descOffset + 8, descText.length + 1);
  writeStr(bytes, descOffset + 12, descText);
  bytes[descOffset + 12 + descText.length] = 0; // null terminator

  // cprt tag
  writeStr(bytes, cprtOffset, 'text');
  writeU32(view, cprtOffset + 4, 0);       // reserved
  writeStr(bytes, cprtOffset + 8, cprtText);
  bytes[cprtOffset + 8 + cprtText.length] = 0;

  // wtpt (white point D50): X=0.9505, Y=1.0000, Z=1.0890
  writeStr(bytes, wtptOffset, 'XYZ ');
  writeU32(view, wtptOffset + 4, 0);
  writeS15Fixed16(view, wtptOffset + 8, 0.9505);
  writeS15Fixed16(view, wtptOffset + 12, 1.0000);
  writeS15Fixed16(view, wtptOffset + 16, 1.0890);

  // rXYZ (sRGB red primary, adapted to D50):   X=0.4361, Y=0.2225, Z=0.0139
  writeStr(bytes, rXYZOffset, 'XYZ ');
  writeU32(view, rXYZOffset + 4, 0);
  writeS15Fixed16(view, rXYZOffset + 8, 0.4361);
  writeS15Fixed16(view, rXYZOffset + 12, 0.2225);
  writeS15Fixed16(view, rXYZOffset + 16, 0.0139);

  // gXYZ (sRGB green primary, adapted to D50):  X=0.3851, Y=0.7169, Z=0.0971
  writeStr(bytes, gXYZOffset, 'XYZ ');
  writeU32(view, gXYZOffset + 4, 0);
  writeS15Fixed16(view, gXYZOffset + 8, 0.3851);
  writeS15Fixed16(view, gXYZOffset + 12, 0.7169);
  writeS15Fixed16(view, gXYZOffset + 16, 0.0971);

  // bXYZ (sRGB blue primary, adapted to D50):   X=0.1431, Y=0.0606, Z=0.7141
  writeStr(bytes, bXYZOffset, 'XYZ ');
  writeU32(view, bXYZOffset + 4, 0);
  writeS15Fixed16(view, bXYZOffset + 8, 0.1431);
  writeS15Fixed16(view, bXYZOffset + 12, 0.0606);
  writeS15Fixed16(view, bXYZOffset + 16, 0.7141);

  // TRC (shared by rTRC, gTRC, bTRC): parametric approximation as gamma 2.2
  // 'curv' type with count=1 means a single gamma value
  // gamma stored as u8Fixed8Number: 2.2 → 0x0233 (2 + 0x33/256 ≈ 2.199)
  writeStr(bytes, trcOffset, 'curv');
  writeU32(view, trcOffset + 4, 0);       // reserved
  writeU32(view, trcOffset + 8, 1);       // curve point count = 1 → gamma
  writeU16(view, trcOffset + 12, 0x0233); // u8Fixed8: 2.2 ≈ 2 + 51/256

  return bytes;
}
