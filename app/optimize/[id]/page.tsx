"use client";

import PromptOptimizer from "../../components/PromptOptimizer";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as CryptoJS from 'crypto-js';
import { decryptSafe } from "../../utils/cryptoUtils";

const SECRET_KEY = 'uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=';

export default function OptimizeSessionPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // Guard: require API key
  useEffect(() => {
    setIsClient(true);
    
    try {
      // Only run on client side
      if (typeof window === 'undefined') return;
      
      const saved = localStorage.getItem('API_KEY');
      if (!saved) {
        console.warn('No API key found in localStorage');
        router.replace('/settings');
        return;
      }
      
      try {
        const result = decryptSafe(
          saved,
          SECRET_KEY,
          undefined,
          CryptoJS.mode.CBC,
          CryptoJS.pad.Pkcs7
        );
        
        if (!result.ok || !result.plaintext) {
          console.warn('Failed to decrypt API key');
          if (!result.ok) {
            const errorResult = result as { reason?: string };
            console.warn('Reason:', errorResult.reason || 'Unknown error');
          }
          router.replace('/settings');
        }
      } catch (error) {
        console.error('Error decrypting API key:', error);
        router.replace('/settings');
      }
    } catch (error) {
      console.error('Error checking API key:', error);
      router.replace('/settings');
    }
  }, [router]);

  // Show loading state until client-side check is complete
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
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-6xl">
        <PromptOptimizer />
      </div>
    </main>
  );
}
