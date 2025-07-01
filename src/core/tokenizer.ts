import { encode } from 'gpt-3-encoder';

export function countTokens(text: string): number {
  if (typeof text !== 'string' || !text) return 0;
  return encode(text).length;
}