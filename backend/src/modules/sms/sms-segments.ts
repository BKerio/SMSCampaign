/**
 * Estimates how many SMS segments a message will consume, for the campaign
 * compose screen's character counter. Uses the standard GSM-7 budget
 * (160 chars for a single segment, 153 per segment once concatenated across
 * multiple) - if the message contains characters outside the GSM-7 alphabet
 * (emoji, most non-Latin scripts) the real gateway would fall back to UCS-2
 * (70 / 67 chars), so this over-estimates conservatively in that case.
 */
const GSM7_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM7_BASIC.includes(ch)) return false;
  }
  return true;
}

export function estimateSmsSegments(message: string): { length: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } {
  const length = message.length;
  const encoding = isGsm7(message) ? 'GSM-7' : 'UCS-2';
  const single = encoding === 'GSM-7' ? 160 : 70;
  const multi = encoding === 'GSM-7' ? 153 : 67;

  if (length === 0) return { length, segments: 0, encoding };
  const segments = length <= single ? 1 : Math.ceil(length / multi);
  return { length, segments, encoding };
}
