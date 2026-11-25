// Pseudo names from Selectors 4, CSS Pseudo 4, CSS Scoping, CSS Shadow Parts, CSS UI 4,
// CSS Overflow 5, CSS View Transitions, WebVTT, HTML and the unprefixed WebKit scrollbar
// pseudo-classes. Lowercase; vendor prefixes are allowed.
const pseudoClasses = new Set([
  'active',
  'active-view-transition',
  'any-link',
  'autofill',
  'blank',
  'buffering',
  'checked',
  'closed',
  'corner-present',
  'current',
  'decrement',
  'default',
  'defined',
  'disabled',
  'double-button',
  'empty',
  'enabled',
  'end',
  'first',
  'first-child',
  'first-of-type',
  'focus',
  'focus-visible',
  'focus-within',
  'fullscreen',
  'future',
  'has-slotted',
  'heading',
  'horizontal',
  'host',
  'hover',
  'in-range',
  'increment',
  'indeterminate',
  'interest-source',
  'invalid',
  'last-child',
  'last-of-type',
  'left',
  'link',
  'local-link',
  'modal',
  'muted',
  'no-button',
  'only-child',
  'only-of-type',
  'open',
  'optional',
  'out-of-range',
  'past',
  'paused',
  'picture-in-picture',
  'placeholder-shown',
  'playing',
  'popover-open',
  'read-only',
  'read-write',
  'required',
  'right',
  'root',
  'scope',
  'seeking',
  'single-button',
  'stalled',
  'start',
  'target',
  'target-current',
  'target-within',
  'unchecked',
  'user-invalid',
  'user-valid',
  'valid',
  'vertical',
  'visited',
  'volume-locked',
  'window-inactive',
  'xr-overlay',
]);
const functionalPseudoClasses = new Set([
  'active-view-transition-type',
  'current',
  'dir',
  'has',
  'host',
  'host-context',
  'is',
  'lang',
  'not',
  'nth-child',
  'nth-col',
  'nth-last-child',
  'nth-last-col',
  'nth-last-of-type',
  'nth-of-type',
  'state',
  'where',
]);
const pseudoElements = new Set([
  'after',
  'backdrop',
  'before',
  'checkmark',
  'column',
  'cue',
  'cue-region',
  'details-content',
  'file-selector-button',
  'first-letter',
  'first-line',
  'grammar-error',
  'marker',
  'picker-icon',
  'placeholder',
  'scroll-marker',
  'scroll-marker-group',
  'search-text',
  'selection',
  'spelling-error',
  'target-text',
  'view-transition',
]);
const functionalPseudoElements = new Set([
  'cue',
  'cue-region',
  'highlight',
  'part',
  'picker',
  'scroll-button',
  'slotted',
  'view-transition-group',
  'view-transition-image-pair',
  'view-transition-new',
  'view-transition-old',
]);

export const legacyPseudoElements = new Set(['after', 'before', 'first-letter', 'first-line']);

export function isKnownPseudo(name: string, element: boolean, functional: boolean): boolean {
  const prefixes = ['-webkit-', '-moz-', '-ms-', '-o-'];

  if (prefixes.some((prefix) => name.startsWith(prefix) && name.length > prefix.length))
    return true;

  if (element) return (functional ? functionalPseudoElements : pseudoElements).has(name);

  return (functional ? functionalPseudoClasses : pseudoClasses).has(name);
}

export function canFollowPseudoElement(previous: string, next: string): boolean {
  if (previous === 'part') return next !== 'part';

  if (previous === 'slotted') return ['after', 'before', 'marker'].includes(next);

  if (previous === 'column') return next === 'scroll-marker';

  return (previous === 'before' || previous === 'after') && next === 'marker';
}
