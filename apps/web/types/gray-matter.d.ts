declare module "gray-matter" {
  export interface GrayMatterFile<T extends Record<string, unknown> = Record<string, unknown>> {
    content: string;
    data: T;
    excerpt?: string;
    language: string;
    matter: string;
    orig: string | Buffer;
  }

  export interface GrayMatterOptions {
    engines?: Record<string, unknown>;
    excerpt?: boolean | ((file: GrayMatterFile) => void);
    excerpt_separator?: string;
  }

  export default function matter<T extends Record<string, unknown> = Record<string, unknown>>(
    input: string | Buffer,
    options?: GrayMatterOptions,
  ): GrayMatterFile<T>;
}
