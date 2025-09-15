import CryptoJS from 'crypto-js';

type DecryptResult =
  | { ok: true; plaintext: string }
  | { ok: false; reason: string };

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

  if (!secret) {
    return { ok: false, reason: 'No secret key provided' };
  }

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
