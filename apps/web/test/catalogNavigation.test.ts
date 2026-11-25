// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  rememberCatalogScroll,
  restoreCatalogScroll,
} from '../src/features/tools/utils/catalogNavigation';
import { blockedStorage } from './blockedStorage';

afterEach(() => vi.unstubAllGlobals());

describe('catalog scroll memory', () => {
  it('keeps working when session storage is blocked', () => {
    vi.stubGlobal('sessionStorage', blockedStorage());

    expect(() => rememberCatalogScroll('/tools')).not.toThrow();
    expect(() => restoreCatalogScroll('/tools')).not.toThrow();
  });
});
