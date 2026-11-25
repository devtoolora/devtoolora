/**
 * Counts the objects of a multiple file field's JSON list without parsing it (the value can be
 * 200 MiB). The files are flat objects, and a `"` inside a string is always escaped as `\"`, so an
 * unescaped `{"` can only open an object, whatever the file names say.
 */
export function countSelectedFiles(value: string): number {
  let count = 0;

  for (let at = value.indexOf('{"'); at !== -1; at = value.indexOf('{"', at + 2)) count += 1;

  return count;
}
