/** A stand-in for the browser's `window` in unit tests: storage in a Map, optionally refusing writes to some keys. */
export function fakeWindow(refuseKeys: readonly string[] = []) {
  const data = new Map<string, string>();
  return {
    localStorage: {
      getItem: (key: string): string | null => data.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        if (refuseKeys.includes(key)) throw new Error("quota exceeded");
        data.set(key, value);
      },
    },
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
  };
}
