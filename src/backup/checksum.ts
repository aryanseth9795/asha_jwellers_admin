/** FNV-1a 32-bit over the UTF-8 bytes of `text`, as 8 lower-case hex digits. Detects damage, not tampering. */
export const fnv1a = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};
