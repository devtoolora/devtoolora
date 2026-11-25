import { useEffect, useRef, useState, type RefObject } from 'react';

type ClipPreviewImage = {
  handleImage(file: File | undefined): void;
  handleImageRemove(): void;
  image: string;
  imageError: string;
  imageInputRef: RefObject<HTMLInputElement | null>;
};

export function useClipPreviewImage(): ClipPreviewImage {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageRevision = useRef(0);
  const [image, setImage] = useState('');
  const [imageError, setImageError] = useState('');

  useEffect(
    () => () => {
      imageRevision.current += 1;
    },
    [],
  );

  const handleImage = (file: File | undefined): void => {
    const revision = ++imageRevision.current;

    setImageError('');
    if (!file) return;

    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setImageError('Choose a PNG, JPEG or WebP image no larger than 5 MiB.');

      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (revision === imageRevision.current && typeof reader.result === 'string')
        setImage(reader.result);
    };

    reader.onerror = () => {
      if (revision === imageRevision.current)
        setImageError('The local preview image could not be read.');
    };

    reader.readAsDataURL(file);
  };

  const handleImageRemove = (): void => {
    imageRevision.current += 1;
    setImage('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return { handleImage, handleImageRemove, image, imageError, imageInputRef };
}
