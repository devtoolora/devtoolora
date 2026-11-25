const count = new Intl.NumberFormat('en-US');

function textStats(text: string): { bytes: number; characters: number; lines: number } {
  let bytes = 0;
  let characters = 0;
  let lines = text ? 1 : 0;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    characters += 1;
    if (code === 10) lines += 1;
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && (text.charCodeAt(index + 1) & 0xfc00) === 0xdc00) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }

  return { bytes, characters, lines };
}

export function textStatsLabel(text: string): string {
  const { bytes, characters, lines } = textStats(text);

  return `${count.format(characters)} ${characters === 1 ? 'character' : 'characters'} · ${count.format(bytes)} ${bytes === 1 ? 'byte' : 'bytes'} · ${count.format(lines)} ${lines === 1 ? 'line' : 'lines'}`;
}
