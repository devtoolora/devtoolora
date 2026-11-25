import {
  AppWindow,
  Code2,
  FileText,
  FolderOpen,
  GitFork,
  Globe,
  HardDrive,
  Keyboard,
  type LucideIcon,
  Palette,
  Replace,
  Scale,
  ShieldCheck,
  Star,
  UserX,
} from 'lucide-react';
import { GITHUB_URL, ISSUES_URL } from '@/lib/siteLinks';

export type PublicPageKind = 'about' | 'apps' | 'extension';

export interface PublicPageFeature {
  href?: string;
  icon: LucideIcon;
  text: string;
  title: string;
  to?: string;
}

export interface PublicPageCommand {
  name: string;
  text: string;
}

export interface PublicPageScreenshot {
  alt: string;
  name: string;
}

export interface PublicPageContent {
  commands?: PublicPageCommand[];
  eyebrow: string;
  features: PublicPageFeature[];
  featuresTitle: string;
  lead: string;
  screenshot?: PublicPageScreenshot;
  status?: string;
  statusNote?: string;
  title: string;
}

export const publicPageContent: Record<PublicPageKind, PublicPageContent> = {
  about: {
    eyebrow: 'About',
    features: [
      {
        icon: ShieldCheck,
        text: 'Tools run on your device. What you paste and the files you pick are never sent anywhere.',
        title: 'Your input stays with you',
      },
      {
        icon: UserX,
        text: 'There are no accounts and no cookies. The site counts anonymous page views, never what you type. You can start using any tool right away.',
        title: 'Nothing to sign up for',
      },
      {
        icon: HardDrive,
        text: 'Favorites and your theme are saved on your device. Drafts are saved only in the VS Code extension, and the desktop app keeps neither your input nor your file paths.',
        title: 'What gets saved',
      },
      {
        href: GITHUB_URL,
        icon: GitFork,
        text: 'The code is on GitHub under the MIT license, so you can read how any tool works.',
        title: 'Open source',
      },
      {
        icon: Scale,
        text: 'Tools warn you when an input is ambiguous or out of range, and say what they did with it.',
        title: 'Clear results',
      },
      {
        href: ISSUES_URL,
        icon: FileText,
        text: 'Found a wrong result or missing a tool? Open an issue on GitHub.',
        title: 'Contact',
      },
    ],
    featuresTitle: 'How it works',
    lead: 'Dev Toolora is a set of more than 250 developer tools for formatting, converting, encoding and checking your data. You can use it on the web, as a desktop app, or in your editor.',
    title: 'Developer tools that stay on your computer.',
  },
  apps: {
    eyebrow: 'Desktop app',
    features: [
      {
        icon: FolderOpen,
        text: 'Open and save files through your system dialogs, and copy results to the system clipboard.',
        title: 'Works with your files',
      },
      {
        icon: Star,
        text: 'Pin your favorite tools and get back to the last eight you opened from the sidebar.',
        title: 'Favorites and recent tools',
      },
      {
        icon: Palette,
        text: 'Pick from six color themes, including Liquid Glass, each in light and dark. Or set your own background color.',
        title: 'Your look',
      },
      {
        icon: HardDrive,
        text: 'The app saves your theme, favorites, recent tools and window size. It does not save your input or file paths.',
        title: 'Keeps only your settings',
      },
    ],
    featuresTitle: 'What you get',
    lead: 'The same tools as the website, in their own window on macOS, Windows and Linux.',
    screenshot: {
      alt: 'The Dev Toolora desktop app with the JSON Format tool open, showing formatted JSON next to the input.',
      name: 'desktop',
    },
    status: 'Coming soon',
    statusNote: 'Downloads will appear here when signed builds are ready.',
    title: 'Every tool in its own window.',
  },
  extension: {
    commands: [
      {
        name: 'Dev Toolora: Transform Selection...',
        text: 'Pick a tool and load the selected text into it.',
      },
      {
        name: 'Dev Toolora: Suggest Tools for Selection',
        text: 'See which tools fit what you selected.',
      },
      {
        name: 'Dev Toolora: Run Tool...',
        text: 'Find a tool by name and open it.',
      },
      {
        name: 'Dev Toolora: Base64 Encode File',
        text: 'Encode a file from the Explorer.',
      },
      {
        name: 'Dev Toolora: Open Active Tool in Editor',
        text: 'Open the current tool in an editor tab.',
      },
    ],
    eyebrow: 'VS Code extension',
    features: [
      {
        icon: Replace,
        text: 'Replace the selection, insert at the cursor or open the result in a new editor.',
        title: 'Results go back into your file',
      },
      {
        icon: AppWindow,
        text: 'The panel uses the colors of your VS Code theme and adjusts as you resize it.',
        title: 'Fits your editor',
      },
      {
        icon: Keyboard,
        text: 'Press Shift+Cmd+R, or Shift+Ctrl+R on Windows and Linux, to run the active tool.',
        title: 'Keyboard first',
      },
      {
        icon: Code2,
        text: 'Your input is restored when the panel reloads, and favorites stay in the sidebar.',
        title: 'Picks up where you left off',
      },
    ],
    featuresTitle: 'What you get',
    lead: 'Select text, pick a tool and put the result back without leaving your file. For VS Code 1.96 or newer and compatible editors.',
    screenshot: {
      alt: 'The Dev Toolora extension in VS Code with the JSON Format tool, showing input on the left and formatted JSON on the right.',
      name: 'extension',
    },
    status: 'Coming soon',
    statusNote: 'The Marketplace link will appear here when the extension is published.',
    title: 'Run tools on your selection, inside your editor.',
  },
};

export const aboutSurfaces: PublicPageFeature[] = [
  {
    icon: Globe,
    text: 'Every tool in your browser, with nothing to install.',
    title: 'Web',
    to: '/tools',
  },
  {
    icon: AppWindow,
    text: 'Native file dialogs on macOS, Windows and Linux.',
    title: 'Desktop',
    to: '/apps',
  },
  {
    icon: Code2,
    text: 'Tools for your selection in VS Code.',
    title: 'Extension',
    to: '/extension',
  },
];
