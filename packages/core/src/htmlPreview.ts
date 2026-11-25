export type HtmlPreviewNode = {
  align?: 'center' | 'left' | 'right';
  children?: HtmlPreviewNode[];
  start?: number;
  tag:
    | 'blockquote'
    | 'br'
    | 'code'
    | 'em'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'hr'
    | 'image'
    | 'li'
    | 'link'
    | 'ol'
    | 'p'
    | 'pre'
    | 's'
    | 'strong'
    | 'table'
    | 'tbody'
    | 'td'
    | 'text'
    | 'th'
    | 'thead'
    | 'tr'
    | 'ul';
  target?: string;
  text?: string;
};
