import crypto from 'crypto';

/**
 * Generates a custom ID with the specified prefix and a 10-character random hex string.
 * Example: generateCustomId('BY-USR') -> 'BY-USR-A1B2C3D4E5'
 *
 * Uses 5 random bytes (10 hex chars = ~1.1 trillion possible values per prefix)
 * to virtually eliminate collision risk even at scale.
 */
export const generateCustomId = (prefix: string): string => {
  const randomHex = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${prefix}-${randomHex}`;
};
