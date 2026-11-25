/** Storage that throws like Safari private mode or a strict cookie policy. */
export function blockedStorage(): Storage {
  const denied = (): never => {
    throw new DOMException('denied', 'SecurityError');
  };

  return {
    clear: denied,
    getItem: denied,
    key: denied,
    get length(): number {
      return denied();
    },
    removeItem: denied,
    setItem: denied,
  };
}
