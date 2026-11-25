const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'tif', 'tiff', 'svg'];

export function extensionsForAccept(accept?: string): string[] {
  if (!accept) return [];
  if (accept.includes('image/*')) return imageExtensions;

  return accept.split(',').flatMap((value) => {
    const token = value.trim().toLowerCase();

    if (token.startsWith('.')) return [token.slice(1)];
    if (token === 'application/pdf') return ['pdf'];

    return [];
  });
}

export function mimeTypeForFile(name: string, accept?: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  const imageTypes: Record<string, string> = {
    avif: 'image/avif',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    webp: 'image/webp',
  };

  if (extension && imageTypes[extension]) return imageTypes[extension];
  if (extension === 'pdf') return 'application/pdf';
  if (extension && ['cer', 'crt', 'key', 'pem', 'pub'].includes(extension)) return 'text/plain';
  if (accept && !accept.includes('*') && !accept.startsWith('.'))
    return accept.split(',')[0] ?? accept;

  return 'application/octet-stream';
}
