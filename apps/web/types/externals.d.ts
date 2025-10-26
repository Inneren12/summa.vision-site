/**
 * Ambient shims for optional external viz libraries.
 * Lets the repo compile even if the library isn't installed.
 * Adapters must dynamically import the real package at runtime.
 */
declare module "@deck.gl/core" {
  export interface DeckProps {
    [key: string]: unknown;
  }
}
