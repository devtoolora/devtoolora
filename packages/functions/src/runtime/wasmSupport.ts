export const WASM_SIMD_MESSAGE =
  "This app's web view blocks or lacks WebAssembly SIMD, which OCR needs. Update the system web view.";

export const WASM_HEIC_MESSAGE =
  "This app's web view blocks WebAssembly, which HEIC decoding needs. Update the system web view.";

const SIMD_PROBE = Uint8Array.of(
  0,
  97,
  115,
  109,
  1,
  0,
  0,
  0,
  1,
  5,
  1,
  96,
  0,
  1,
  123,
  3,
  2,
  1,
  0,
  10,
  10,
  1,
  8,
  0,
  65,
  0,
  253,
  15,
  253,
  98,
  11,
);

export function isWasmBlockedError(error: unknown): boolean {
  return /CompileError|Content Security Policy|wasm-unsafe-eval|unsafe-eval/i.test(
    error instanceof Error ? `${error.name} ${error.message}` : String(error),
  );
}

export function supportsWasmSimd(): boolean {
  return typeof WebAssembly === 'object' && WebAssembly.validate(SIMD_PROBE);
}
