"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import * as CryptoJS from 'crypto-js';

const SECRET_KEY = 'your-super-secret-key';

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function OptimizePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gemini-api-key');
      const decrypted = saved ? CryptoJS.AES.decrypt(saved, SECRET_KEY).toString(CryptoJS.enc.Utf8) : '';
      if (!decrypted) {
        router.replace('/settings');
        return;
      }
      router.replace(`/optimize/${newId()}`);
    } catch {
      router.replace('/settings');
    }
  }, [router]);

  return null;
}
