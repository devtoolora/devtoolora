/** The platforms' published image sizes as of 2026. */
export const socialImagePresets: ReadonlyArray<{
  height: number;
  id: string;
  label: string;
  width: number;
}> = [
  { height: 1080, id: 'instagram-square', label: 'Instagram square', width: 1080 },
  { height: 1350, id: 'instagram-portrait', label: 'Instagram portrait', width: 1080 },
  { height: 1920, id: 'instagram-story', label: 'Instagram Story / Reel', width: 1080 },
  {
    height: 630,
    id: 'open-graph',
    label: 'Open Graph link preview',
    width: 1200,
  },
  { height: 315, id: 'facebook-cover', label: 'Facebook cover', width: 851 },
  { height: 900, id: 'x-post', label: 'X post', width: 1600 },
  { height: 500, id: 'x-header', label: 'X header', width: 1500 },
  { height: 627, id: 'linkedin-post', label: 'LinkedIn post', width: 1200 },
  { height: 396, id: 'linkedin-banner', label: 'LinkedIn banner', width: 1584 },
  { height: 720, id: 'youtube-thumbnail', label: 'YouTube thumbnail', width: 1280 },
  { height: 1440, id: 'youtube-banner', label: 'YouTube banner', width: 2560 },
  { height: 1500, id: 'pinterest-pin', label: 'Pinterest pin', width: 1000 },
];
