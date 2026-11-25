export async function loadFigletFont(font: string): Promise<string> {
  const module = await import(`figlet/importable-fonts/${font}.js`);

  return module.default;
}
