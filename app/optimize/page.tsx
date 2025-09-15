"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as CryptoJS from 'crypto-js';
import { decryptSafe } from "../utils/cryptoUtils";

const SECRET_KEY = process.env.NEXT_PUBLIC_SECRET_KEY as string;

if (!SECRET_KEY) {
  throw new Error("NEXT_PUBLIC_SECRET_KEY is not defined");
}

export default function OptimizePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    try {
      // Check for API key before allowing access
      const savedKey = localStorage.getItem('API_KEY');
      if (!savedKey) {
        console.warn('No API key found in localStorage');
        router.replace('/settings');
        return;
      }
      
      const result = decryptSafe(
        savedKey,
        SECRET_KEY,
        undefined,
        CryptoJS.mode.CBC,
        CryptoJS.pad.Pkcs7
      );
      
      if (!result.ok || !result.plaintext) {
        console.warn('Failed to decrypt API key');
        router.replace('/settings');
        return;
      }
      
      // Generate new session ID and redirect to it
      const newId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      router.replace(`/optimize/${newId}`);
      
    } catch (error) {
      console.error('Error checking API key:', error);
      router.replace('/settings');
    }
  }, [router]);

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Creating new optimization session...</span>
      </div>
    </div>
  );
}
