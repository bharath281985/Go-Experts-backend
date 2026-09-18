import crypto from 'crypto';

// The key should be exactly 32 bytes (256 bits) for AES-256-GCM.
// We fallback to a hardcoded string ONLY if the env is missing, but in production,
// this should ALWAYS come from process.env.AES_ENCRYPTION_KEY.
const ENCRYPTION_KEY = process.env.AES_ENCRYPTION_KEY || 'goexperts-fallback-32-byte-key!!'; 
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard IV length for GCM
const AUTH_TAG_LENGTH = 16; // Standard auth tag length for GCM

/**
 * Encrypts a plain-text password using AES-256-GCM.
 * @param text The plain text password
 * @returns The encrypted password in the format `iv:authTag:encryptedText` (hex encoded)
 */
export function encryptPassword(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv(hex) : authTag(hex) : encryptedText(hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a password that was encrypted using encryptPassword.
 * @param encryptedData The `iv:authTag:encryptedText` string
 * @returns The decrypted plain text password
 */
export function decryptPassword(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) {
    return encryptedData; // Return as-is if it's not in our encrypted format
  }
  
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Password decryption failed:', err);
    throw new Error('Failed to decrypt password');
  }
}

