// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ErrorBoundary } from '../src/root';
import styles from '../src/root.module.scss';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('root ErrorBoundary', () => {
  it('renders its own styles and links home through the router', async () => {
    const Stub = createRoutesStub([
      { Component: () => <ErrorBoundary error={new Error('boom')} />, path: '/' },
    ]);
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => root.render(<Stub />));

    expect(styles.errorPage).toBeTruthy();
    expect(container.querySelector('main')?.className).toContain(styles.errorPage);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
    expect(container.querySelector('a')?.dataset.discover).toBe('true');

    await act(async () => root.unmount());
  });
});
