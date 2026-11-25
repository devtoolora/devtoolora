const labelPattern = /^[A-Za-z0-9-]{1,63}$/;
const digitsPattern = /^[0-9]+$/;

export function isDnsName(value: string): boolean {
  if (value.length === 0 || value.length > 253) return false;

  const labels = value.split('.');

  if (labels.every((label) => digitsPattern.test(label))) return false;

  return labels.every(
    (label) => labelPattern.test(label) && !label.startsWith('-') && !label.endsWith('-'),
  );
}
