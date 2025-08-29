import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique identifier using UUID v4
 * Centralizes ID generation for consistency across the application
 * @returns A unique UUID v4 string
 */
export function getUniqueId(): string {
  return uuidv4();
}