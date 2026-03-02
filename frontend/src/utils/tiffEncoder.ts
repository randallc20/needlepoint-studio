/**
 * Minimal uncompressed RGB TIFF encoder for the browser.
 *
 * Generates a valid TIFF file with:
 *   - Exact DPI metadata (XResolution / YResolution tags)
 *   - Optional embedded ICC color profile (tag 34675)
 *   - Uncompressed RGB pixel data (no lossy compression)
 *   - Single-strip layout for simplicity
 *
 * TIFF 6.0 spec: https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf
 * All values are Little Endian (Intel byte order).
 */

// ─── TIFF tag constants ────────────────────────────────────────────────

const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TAG_BITS_PER_SAMPLE = 258;
const TAG_COMPRESSION = 259;
const TAG_PHOTOMETRIC = 262;
const TAG_STRIP_OFFSETS = 273;
const TAG_SAMPLES_PER_PIXEL = 277;
const TAG_ROWS_PER_STRIP = 278;
const TAG_STRIP_BYTE_COUNTS = 279;
const TAG_X_RESOLUTION = 282;
const TAG_Y_RESOLUTION = 283;
const TAG_RESOLUTION_UNIT = 296;
const TAG_SOFTWARE = 305;
const TAG_ICC_PROFILE = 34675;

// TIFF data types
const TYPE_SHORT = 3;   // 2 bytes
const TYPE_LONG = 4;    // 4 bytes
const TYPE_RATIONAL = 5; // 8 bytes (num + denom)
const TYPE_ASCII = 2;    // 1 byte per char
const TYPE_UNDEFINED = 7; // 1 byte

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Build an uncompressed RGB TIFF file.
 *
 * @param pixels    - RGB pixel data, row-major, 3 bytes per pixel.
 *                    Length must be exactly width * height * 3.
 * @param width     - Image width in pixels
 * @param height    - Image height in pixels
 * @param dpi       - Resolution in dots per inch (embedded as XRes/YRes)
 * @param iccProfile - Optional ICC color profile bytes to embed
 * @returns Blob with MIME type image/tiff
 */
export function buildTiff(
  pixels: Uint8Array,
  width: number,
  height: number,
  dpi: number,
  iccProfile?: Uint8Array
): Blob {
  const expectedLen = width * height * 3;
  if (pixels.length !== expectedLen) {
    throw new Error(
      `Pixel data length ${pixels.length} doesn't match ${width}×${height}×3 = ${expectedLen}`
    );
  }

  const softwareStr = 'NeedlePoint Studio\0'; // null-terminated ASCII
  const hasIcc = iccProfile && iccProfile.length > 0;

  // Count IFD entries
  const tagCount = hasIcc ? 14 : 13;

  // ── Calculate sizes and offsets ──────────────────────────────────────

  // Layout:
  //   [Header: 8 bytes]
  //   [IFD: 2 + tagCount*12 + 4 bytes]
  //   [Aux data: BitsPerSample(6) + XRes(8) + YRes(8) + Software(N) + ICC(N)]
  //   [Pixel data: width * height * 3 bytes]

  const headerSize = 8;
  const ifdSize = 2 + tagCount * 12 + 4; // count(2) + entries + next IFD offset(4)
  const ifdOffset = headerSize;
  const auxStart = headerSize + ifdSize;

  // Auxiliary data blocks (each must be at an even offset for TIFF compliance)
  let auxOffset = auxStart;

  // BitsPerSample: 3 SHORT values = 6 bytes
  const bpsOffset = auxOffset;
  auxOffset += 6;

  // XResolution: RATIONAL = 8 bytes
  const xResOffset = auxOffset;
  auxOffset += 8;

  // YResolution: RATIONAL = 8 bytes
  const yResOffset = auxOffset;
  auxOffset += 8;

  // Software: ASCII string
  const softwareOffset = auxOffset;
  auxOffset += softwareStr.length;
  // Pad to even
  if (auxOffset % 2 !== 0) auxOffset++;

  // ICC Profile (if present)
  let iccOffset = 0;
  if (hasIcc) {
    iccOffset = auxOffset;
    auxOffset += iccProfile!.length;
    if (auxOffset % 2 !== 0) auxOffset++;
  }

  // Pixel data starts after all auxiliary data
  const pixelOffset = auxOffset;
  const pixelSize = width * height * 3;
  const totalSize = pixelOffset + pixelSize;

  // ── Allocate buffer ──────────────────────────────────────────────────

  const buffer = new ArrayBuffer(totalSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // ── Header (8 bytes) ────────────────────────────────────────────────

  // Byte order: Little Endian ('II')
  bytes[0] = 0x49; // 'I'
  bytes[1] = 0x49; // 'I'

  // Magic number: 42
  view.setUint16(2, 42, true);

  // Offset to first IFD
  view.setUint32(4, ifdOffset, true);

  // ── IFD ──────────────────────────────────────────────────────────────

  let pos = ifdOffset;

  // Tag count
  view.setUint16(pos, tagCount, true);
  pos += 2;

  // Helper: write one IFD entry (12 bytes)
  // For values that fit in 4 bytes, the value is stored inline.
  // For larger values, the 4-byte field holds an offset to the data.
  function writeIfdEntry(
    tag: number,
    type: number,
    count: number,
    valueOrOffset: number
  ) {
    view.setUint16(pos, tag, true);
    pos += 2;
    view.setUint16(pos, type, true);
    pos += 2;
    view.setUint32(pos, count, true);
    pos += 4;
    // Value/offset field (4 bytes)
    if (type === TYPE_SHORT && count <= 2) {
      // Pack SHORT values into the 4-byte field
      view.setUint16(pos, valueOrOffset, true);
      pos += 4;
    } else {
      view.setUint32(pos, valueOrOffset, true);
      pos += 4;
    }
  }

  // IFD entries MUST be sorted by tag number (TIFF requirement)

  // 256: ImageWidth (LONG)
  writeIfdEntry(TAG_IMAGE_WIDTH, TYPE_LONG, 1, width);

  // 257: ImageLength (LONG)
  writeIfdEntry(TAG_IMAGE_LENGTH, TYPE_LONG, 1, height);

  // 258: BitsPerSample (3 SHORTs → offset to aux data)
  writeIfdEntry(TAG_BITS_PER_SAMPLE, TYPE_SHORT, 3, bpsOffset);

  // 259: Compression = 1 (no compression)
  writeIfdEntry(TAG_COMPRESSION, TYPE_SHORT, 1, 1);

  // 262: PhotometricInterpretation = 2 (RGB)
  writeIfdEntry(TAG_PHOTOMETRIC, TYPE_SHORT, 1, 2);

  // 273: StripOffsets (LONG → single strip at pixelOffset)
  writeIfdEntry(TAG_STRIP_OFFSETS, TYPE_LONG, 1, pixelOffset);

  // 277: SamplesPerPixel = 3
  writeIfdEntry(TAG_SAMPLES_PER_PIXEL, TYPE_SHORT, 1, 3);

  // 278: RowsPerStrip = height (single strip)
  writeIfdEntry(TAG_ROWS_PER_STRIP, TYPE_LONG, 1, height);

  // 279: StripByteCounts (LONG)
  writeIfdEntry(TAG_STRIP_BYTE_COUNTS, TYPE_LONG, 1, pixelSize);

  // 282: XResolution (RATIONAL → offset)
  writeIfdEntry(TAG_X_RESOLUTION, TYPE_RATIONAL, 1, xResOffset);

  // 283: YResolution (RATIONAL → offset)
  writeIfdEntry(TAG_Y_RESOLUTION, TYPE_RATIONAL, 1, yResOffset);

  // 296: ResolutionUnit = 2 (inch)
  writeIfdEntry(TAG_RESOLUTION_UNIT, TYPE_SHORT, 1, 2);

  // 305: Software (ASCII → offset)
  writeIfdEntry(TAG_SOFTWARE, TYPE_ASCII, softwareStr.length, softwareOffset);

  // 34675: ICCProfile (UNDEFINED → offset) — only if provided
  if (hasIcc) {
    writeIfdEntry(TAG_ICC_PROFILE, TYPE_UNDEFINED, iccProfile!.length, iccOffset);
  }

  // Next IFD offset = 0 (no more IFDs)
  view.setUint32(pos, 0, true);

  // ── Auxiliary data ───────────────────────────────────────────────────

  // BitsPerSample: [8, 8, 8]
  view.setUint16(bpsOffset, 8, true);
  view.setUint16(bpsOffset + 2, 8, true);
  view.setUint16(bpsOffset + 4, 8, true);

  // XResolution: DPI as rational (numerator / denominator)
  view.setUint32(xResOffset, dpi, true);     // numerator
  view.setUint32(xResOffset + 4, 1, true);   // denominator

  // YResolution: same as X
  view.setUint32(yResOffset, dpi, true);
  view.setUint32(yResOffset + 4, 1, true);

  // Software string
  for (let i = 0; i < softwareStr.length; i++) {
    bytes[softwareOffset + i] = softwareStr.charCodeAt(i);
  }

  // ICC Profile
  if (hasIcc) {
    bytes.set(iccProfile!, iccOffset);
  }

  // ── Pixel data ───────────────────────────────────────────────────────

  bytes.set(pixels, pixelOffset);

  return new Blob([buffer], { type: 'image/tiff' });
}
