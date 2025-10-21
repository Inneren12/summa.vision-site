import type { TokenPath } from '../../shared/theme/tokens';
import { getTokenValue } from '../../shared/theme/tokens';

export function tokenPathToCssVar(path: TokenPath): string {
  const dashed = path.replace(/\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `--${dashed}`;
}

export function resolveToken(path: TokenPath): string {
  return String(getTokenValue(path));
}

export interface TokenMeta {
  token: TokenPath;
  label?: string;
  description?: string;
  cssVariable?: string;
}
