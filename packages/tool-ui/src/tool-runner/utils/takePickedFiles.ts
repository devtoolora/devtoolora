import type { ChangeEvent } from 'react';

// Empties the input after handing over its files, so picking the same file again fires change.
export function takePickedFiles(event: ChangeEvent<HTMLInputElement>): File[] {
  const files = [...(event.target.files ?? [])];

  event.target.value = '';

  return files;
}
