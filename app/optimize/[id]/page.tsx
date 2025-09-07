"use client";

import PromptOptimizer from "../../components/PromptOptimizer";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import * as CryptoJS from 'crypto-js';

const SECRET_KEY = 'uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=';

export default function OptimizeSessionPage() {
  const router = useRouter();

  // Guard: require API key
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gemini-api-key');
      const decrypted = saved ? CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(CryptoJS.enc.Utf8) : '';
      if (!decrypted) router.replace('/settings');
    } catch {
      router.replace('/settings');
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-6xl">
        <PromptOptimizer />
      </div>
    </main>
  );
}
