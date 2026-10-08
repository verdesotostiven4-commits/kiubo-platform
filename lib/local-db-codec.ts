/**
 * Lossless compact storage of the full KIUBO database. Previous plain JSON
 * remains readable. This is a synchronous LZ4-style block codec: cashier
 * actions must be persisted before switching service contexts.
 */
const PREFIX = "kiubo:lz4:v1:";
const HEADER_BYTES = 8;
const HASH_MULTIPLIER = 2654435761;
const MAX_DISTANCE = 65535;
const MIN_MATCH = 4;
const MAX_JSON_BYTES = 40 * 1024 * 1024;

function checksum(bytes: Uint8Array): number {
  let value = 2166136261;
  for (let index = 0; index < bytes.length; index++) {
    value ^= bytes[index];
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function packBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 8192) binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(binary);
}

function unpackBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at);
  return bytes;
}

function getWord(data: Uint8Array, at: number) {
  return (data[at] | (data[at + 1] << 8) | (data[at + 2] << 16) | (data[at + 3] << 24)) >>> 0;
}
function putLength(output: number[], remainder: number) {
  while (remainder >= 255) { output.push(255); remainder -= 255; }
  output.push(remainder);
}

function compress(data: Uint8Array): Uint8Array {
  const table = new Int32Array(65536);
  table.fill(-1);
  const output: number[] = [];
  let anchor = 0;
  let cursor = 0;
  while (cursor + MIN_MATCH <= data.length) {
    const word = getWord(data, cursor);
    const hash = Math.imul(word, HASH_MULTIPLIER) >>> 16;
    const candidate = table[hash];
    table[hash] = cursor;
    if (candidate < 0 || cursor - candidate > MAX_DISTANCE || getWord(data, candidate) !== word) {
      cursor++;
      continue;
    }
    let matchEnd = cursor + MIN_MATCH;
    while (matchEnd < data.length && data[candidate + matchEnd - cursor] === data[matchEnd]) matchEnd++;
    const literalLength = cursor - anchor;
    const matchLength = matchEnd - cursor - MIN_MATCH;
    output.push((Math.min(15, literalLength) << 4) | Math.min(15, matchLength));
    if (literalLength >= 15) putLength(output, literalLength - 15);
    for (let at = anchor; at < cursor; at++) output.push(data[at]);
    const distance = cursor - candidate;
    output.push(distance & 255, distance >>> 8);
    if (matchLength >= 15) putLength(output, matchLength - 15);
    for (let at = cursor + 1; at + MIN_MATCH <= matchEnd; at++) {
      table[Math.imul(getWord(data, at), HASH_MULTIPLIER) >>> 16] = at;
    }
    cursor = matchEnd;
    anchor = cursor;
  }
  const remaining = data.length - anchor;
  output.push(Math.min(15, remaining) << 4);
  if (remaining >= 15) putLength(output, remaining - 15);
  for (let at = anchor; at < data.length; at++) output.push(data[at]);
  const result = new Uint8Array(HEADER_BYTES + output.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length, true);
  view.setUint32(4, checksum(data), true);
  result.set(output, HEADER_BYTES);
  return result;
}

function decompress(data: Uint8Array): Uint8Array {
  if (data.length < HEADER_BYTES + 1) throw new Error("KIUBO: copia local comprimida incompleta");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const length = view.getUint32(0, true);
  if (length > MAX_JSON_BYTES) throw new Error("KIUBO: longitud de copia local inválida");
  const output = new Uint8Array(length);
  let source = HEADER_BYTES;
  let target = 0;
  const additionalLength = (initial: number) => {
    if (initial < 15) return initial;
    let len = initial;
    while (true) {
      if (source >= data.length) throw new Error("KIUBO: longitud comprimida inválida");
      const next = data[source++];
      len += next;
      if (next !== 255) return len;
    }
  };
  while (source < data.length) {
    const token = data[source++];
    const literalLength = additionalLength(token >>> 4);
    if (target + literalLength > length || source + literalLength > data.length) throw new Error("KIUBO: literal comprimido inválido");
    output.set(data.subarray(source, source + literalLength), target);
    source += literalLength;
    target += literalLength;
    if (source === data.length) break;
    if (source + 2 > data.length) throw new Error("KIUBO: desplazamiento comprimido incompleto");
    const distance = data[source++] | (data[source++] << 8);
    if (distance === 0 || distance > target) throw new Error("KIUBO: desplazamiento comprimido inválido");
    const matchLength = MIN_MATCH + additionalLength(token & 15);
    if (target + matchLength > length) throw new Error("KIUBO: longitud de secuencia inválida");
    for (let at = 0; at < matchLength; at++) output[target + at] = output[target + at - distance];
    target += matchLength;
  }
  if (target !== length || checksum(output) !== view.getUint32(4, true)) throw new Error("KIUBO: la copia local no pasó la verificación de integridad");
  return output;
}

/** Avoid migrations or synchronous compression work for small databases. */
export function encodeDatabaseStorage(rawJson: string): string {
  if (rawJson.length < 64_000) return rawJson;
  const binary = new TextEncoder().encode(rawJson);
  if (binary.length > MAX_JSON_BYTES) throw new Error("KIUBO: base local demasiado grande; se requiere reconciliación segura");
  const packed = PREFIX + packBase64(compress(binary));
  return packed.length < rawJson.length ? packed : rawJson;
}

export function decodeDatabaseStorage(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  return new TextDecoder("utf-8", {fatal: true}).decode(decompress(unpackBase64(stored.slice(PREFIX.length))));
}
