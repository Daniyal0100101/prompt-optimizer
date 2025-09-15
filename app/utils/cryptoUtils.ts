import CryptoJS from 'crypto-js';

type DecryptResult =
  | { ok: true; plaintext: string }
  | { ok: false; reason: string };

// Derive a 16-byte IV from a secret using SHA-256 (first 16 chars)
export const getIV = (secret: string): string => {
  return CryptoJS.SHA256(secret).toString().substring(0, 16);
};

export const decryptSafe = (
  encrypted: string | CryptoJS.lib.CipherParams,
  secret: string,
  iv?: string,
  mode: typeof CryptoJS.mode.CBC = CryptoJS.mode.CBC,
  padding: typeof CryptoJS.pad.Pkcs7 = CryptoJS.pad.Pkcs7
): DecryptResult => {
  if (!encrypted) {
    return { ok: false, reason: 'No encrypted data provided' };
  }

  // Allow empty string secrets to support deployments without NEXT_PUBLIC_SECRET_KEY.

  try {
    const options: {
      mode: typeof mode;
      padding: typeof padding;
      iv?: CryptoJS.lib.WordArray;
    } = { mode, padding };
    
    if (iv) {
      options.iv = CryptoJS.enc.Utf8.parse(iv);
    }

    const decrypted = CryptoJS.AES.decrypt(encrypted, secret, options);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      return { ok: false, reason: 'Decryption resulted in empty string' };
    }

    return { ok: true, plaintext };
  } catch (error) {
    return { 
      ok: false, 
      reason: error instanceof Error ? error.message : 'Unknown decryption error' 
    };
  }
};
