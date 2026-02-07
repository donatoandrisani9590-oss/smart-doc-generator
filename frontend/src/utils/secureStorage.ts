/**
 * Secure Storage Utility
 *
 * Provides encrypted storage for sensitive data using Web Crypto API.
 * Uses sessionStorage (cleared on tab close) instead of localStorage.
 *
 * Security Features:
 * - AES-GCM encryption (256-bit key)
 * - Session-based storage (cleared on tab close)
 * - Key derived from user session
 * - No plaintext sensitive data in browser storage
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Generate encryption key from user token.
 * In production, use the user's JWT token as seed.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
    // Get user token from sessionStorage (set during login)
    const token = sessionStorage.getItem('auth_token') || 'default-key';

    // Derive key from token using PBKDF2
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(token),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('smart-doc-generator-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt data using AES-GCM.
 */
async function encrypt(data: string): Promise<string> {
    try {
        const key = await getEncryptionKey();
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        // Generate random IV (12 bytes for GCM)
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Encrypt
        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: ALGORITHM, iv },
            key,
            dataBuffer
        );

        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encryptedBuffer), iv.length);

        // Convert to base64
        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt data using AES-GCM.
 */
async function decrypt(encryptedData: string): Promise<string> {
    try {
        const key = await getEncryptionKey();

        // Decode base64
        const combined = new Uint8Array(
            atob(encryptedData).split('').map(c => c.charCodeAt(0))
        );

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        // Decrypt
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv },
            key,
            data
        );

        // Convert to string
        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Secure Storage API
 * Drop-in replacement for localStorage with encryption.
 */
export const secureStorage = {
    /**
     * Store encrypted data in sessionStorage.
     * Data is automatically cleared when tab closes.
     */
    async setItem(key: string, value: unknown): Promise<void> {
        try {
            const jsonString = JSON.stringify(value);
            const encrypted = await encrypt(jsonString);
            sessionStorage.setItem(`secure_${key}`, encrypted);
        } catch (error) {
            console.error(`Failed to store ${key}:`, error);
            throw error;
        }
    },

    /**
     * Retrieve and decrypt data from sessionStorage.
     */
    async getItem<T>(key: string): Promise<T | null> {
        try {
            const encrypted = sessionStorage.getItem(`secure_${key}`);
            if (!encrypted) return null;

            const decrypted = await decrypt(encrypted);
            return JSON.parse(decrypted) as T;
        } catch (error) {
            console.error(`Failed to retrieve ${key}:`, error);
            // Clear corrupted data
            sessionStorage.removeItem(`secure_${key}`);
            return null;
        }
    },

    /**
     * Remove encrypted data.
     */
    removeItem(key: string): void {
        sessionStorage.removeItem(`secure_${key}`);
    },

    /**
     * Clear all secure storage.
     */
    clear(): void {
        // Only clear items with 'secure_' prefix
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('secure_')) {
                sessionStorage.removeItem(key);
            }
        });
    },

    /**
     * Check if secure storage is available.
     */
    isAvailable(): boolean {
        try {
            return typeof sessionStorage !== 'undefined' &&
                   typeof crypto.subtle !== 'undefined';
        } catch {
            return false;
        }
    }
};

/**
 * Example usage:
 *
 * // Store sensitive form data
 * await secureStorage.setItem('draft_data', {
 *   employee_name: 'Max Mustermann',
 *   salary: '50000',
 *   ssn: '123-45-6789'
 * });
 *
 * // Retrieve
 * const data = await secureStorage.getItem('draft_data');
 *
 * // Remove
 * secureStorage.removeItem('draft_data');
 */
