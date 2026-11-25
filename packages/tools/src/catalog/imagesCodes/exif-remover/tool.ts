import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import { fileBytesFromField } from '../../../adapters/files';
import {
  browserSafeCapabilities,
  replaceExtension,
  fileExtension,
  SAMPLE_GPS_JPEG_DATA_URI,
  SAMPLE_PNG_DATA_URI,
  SAMPLE_TRANSPARENT_PNG_DATA_URI,
} from '../shared';

/** A 16 × 16 JPEG with camera, software, artist and copyright tags but no location. */
const SAMPLE_AUTHOR_JPEG_DATA_URI =
  'data:image/jpeg;base64,/9j/4QCiRXhpZgAASUkqAAgAAAAFAA8BAgAGAAAASgAAABABAgANAAAAUAAAADEBAgAUAAAAXgAAADsBAgAPAAAAcgAAAJiCAgAYAAAAggAAAAAAAABDYW5vbgBDYW5vbiBFT1MgUjYAAEFkb2JlIExpZ2h0cm9vbSA3LjQARXhhbXBsZSBTdHVkaW8AAChjKSAyMDI2IEV4YW1wbGUgU3R1ZGlvAP/bAEMADQkKCwoIDQsKCw4ODQ8TIBUTEhITJxweFyAuKTEwLiktLDM6Sj4zNkY3LC1AV0FGTE5SU1IyPlphWlBgSlFST//bAEMBDg4OExETJhUVJk81LTVPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT//AABEIABAAEAMBIgACEQEDEQH/xAAVAAEBAAAAAAAAAAAAAAAAAAAABf/EABwQAAEDBQAAAAAAAAAAAAAAABEFE2EAEhQjQv/EABQBAQAAAAAAAAAAAAAAAAAAAAX/xAAeEQABAQkAAAAAAAAAAAAAAAAAERMhIzFRYWKBkf/aAAwDAQACEQMRAD8AlJqfnubW7BySTMUUk/Ab2uXnkACZomqGA5qcvHQAMTRSUM9vU3YeiSIij47fDVOzDXJc/9k=';

const SAMPLE_PLAIN_JPEG_DATA_URI =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAQABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAIF/8QAFhAAAwAAAAAAAAAAAAAAAAAAABRh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwT/xAAXEQADAQAAAAAAAAAAAAAAAAAAFGEV/9oADAMBAAIRAxEAPwCGqGqYrVDVAzYXv0//2Q==';

const SAMPLE_WEBP_DATA_URI =
  'data:image/webp;base64,UklGRmoAAABXRUJQVlA4IF4AAAAQAwCdASoQABAAAUAmJbACdLoAs//zAN6A/YD4AP/+EVAA/u96b/4MF/+CYn//gEl/36Zw2jlMa+v463ejzrzc/h1d1Gbe3w/Xkh4WF43/8NCG97nL27iLJB4KbBAA';

export const exifRemoverTool: ToolDefinition = {
  id: 'exif-remover',
  keywords: ['exif', 'metadata', 'gps', 'privacy', 'strip metadata', 'photo'],
  name: 'Image Metadata & EXIF Remover',
  category: 'Images & Codes',
  description: 'Show image metadata, then export a metadata-stripped copy.',
  inputKind: 'none',
  outputKind: 'json',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save', 'copy', 'scratch'],
  fields: [{ id: 'image', label: 'Image file', required: true, type: 'file', accept: 'image/*' }],
  relatedToolIds: ['image-tools', 'batch-image-tools', 'pdf-metadata-editor'],
  samples: [
    {
      fields: { image: SAMPLE_GPS_JPEG_DATA_URI, imageName: 'IMG_2041.jpg' },
      label: 'Phone photo with GPS location',
    },
    {
      fields: { image: SAMPLE_AUTHOR_JPEG_DATA_URI, imageName: 'portfolio-leaf.jpg' },
      label: 'Edited photo with author and copyright',
    },
    {
      fields: { image: SAMPLE_PLAIN_JPEG_DATA_URI, imageName: 'export.jpg' },
      label: 'JPEG without metadata',
    },
    {
      fields: { image: SAMPLE_PNG_DATA_URI, imageName: 'screenshot.png' },
      label: 'PNG screenshot without metadata',
    },
    {
      fields: { image: SAMPLE_TRANSPARENT_PNG_DATA_URI, imageName: 'logo.png' },
      label: 'Transparent PNG stays PNG',
    },
    {
      fields: { image: SAMPLE_WEBP_DATA_URI, imageName: 'sticker.webp' },
      label: 'WebP stays WebP',
    },
  ],
  run: ({ fields }) => removeExifMetadata(fields),
};

async function removeExifMetadata(fields: Record<string, string>): Promise<ToolResult> {
  const source = fileBytesFromField(fields.image, 'Image file');
  const name = fields.imageName || 'image';
  const result = await withToolErrorAsync(() =>
    imageFunctions.removeImageMetadata({ name, ...source }),
  );
  const report = {
    file: { name, width: result.width, height: result.height, mimeType: source.mimeType },
    metadata: {
      hasExif: result.hasMetadata,
      ...(result.metadataChunks ? { chunks: result.metadataChunks } : {}),
      parsed: result.metadata,
    },
  };

  return {
    text: JSON.stringify(report, null, 2),
    language: 'json',
    ...(result.webpFallback
      ? {
          summary:
            'This browser cannot save WebP, so the copy is a JPEG with transparent areas filled white.',
        }
      : {}),
    artifact: {
      base64: base64Encode(result.image.bytes),
      mimeType: result.image.mimeType,
      fileName: replaceExtension(
        name,
        `metadata-stripped.${fileExtension(result.image.extension)}`,
      ),
    },
  };
}
