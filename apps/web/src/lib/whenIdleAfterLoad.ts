export function whenIdleAfterLoad(callback: () => void): () => void {
  let cancelIdle = (): void => {};

  const scheduleIdle = (): void => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(callback, { timeout: 2000 });

      cancelIdle = () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(callback, 1);

      cancelIdle = () => clearTimeout(id);
    }
  };

  if (document.readyState === 'complete') {
    scheduleIdle();
  } else {
    window.addEventListener('load', scheduleIdle, { once: true });
  }

  return () => {
    window.removeEventListener('load', scheduleIdle);
    cancelIdle();
  };
}
