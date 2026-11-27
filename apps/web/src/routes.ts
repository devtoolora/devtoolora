import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('desktop', 'routes/desktop.tsx'),
  layout('routes/site-layout.tsx', [
    route('tools', 'routes/tools.tsx'),
    route('tools/:slug', 'routes/tool-detail.tsx'),
    route('extension', 'routes/extension.tsx'),
    route('about', 'routes/about.tsx'),
  ]),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
