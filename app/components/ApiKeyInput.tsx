"use client";

import { useState, useEffect } from 'react';
import { FiKey, FiCheck, FiAlertCircle, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';
import * as CryptoJS from 'crypto-js';

const SECRET_KEY = 'uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=';

interface ApiKeyInputProps {
  onKeyVerified: (isVerified: boolean) => void;
  className?: string;
  showTitle?: boolean;
}

export default function ApiKeyInput({ onKeyVerified, className = '', showTitle = true }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Check for saved API key on component mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
      try {
        const decryptedKey = CryptoJS.AES.decrypt(savedKey, SECRET_KEY).toString(CryptoJS.enc.Utf8);
        if (decryptedKey) {
          setApiKey(decryptedKey);
          setIsValid(true);
          setIsSaved(true);
        }
      } catch (error) {
        console.error('Error loading saved API key:', error);
      }
    }
  }, []);

  const validateApiKey = (key: string): boolean => {
    // Basic pattern check for Gemini API key
    const pattern = /^AIza[0-9A-Za-z\-_]{35}$/;
    return pattern.test(key);
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    setApiKey(key);
    
    if (key === '') {
      setIsValid(null);
    } else {
      setIsValid(validateApiKey(key));
    }
  };

  const handleSaveKey = () => {
    if (!apiKey) {
      toast.error('Please enter an API key');
      return;
    }

    if (!validateApiKey(apiKey)) {
      toast.error('Please enter a valid Gemini API key');
      return;
    }

    try {
      // Encrypt and save the key
      const encryptedKey = CryptoJS.AES.encrypt(apiKey, SECRET_KEY).toString();
      localStorage.setItem('gemini-api-key', encryptedKey);
      setIsSaved(true);
      onKeyVerified(true);
      toast.success('API key saved successfully!');
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Failed to save API key');
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini-api-key');
    setApiKey('');
    setIsValid(null);
    setIsSaved(false);
    onKeyVerified(false);
    toast.success('API key cleared');
  };

  return (
    <div className={`bg-secondary/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 shadow-lg ${className}`}>
      {showTitle && (
        <div className="flex items-center mb-4">
          <FiKey className="text-accent mr-2" />
          <h2 className="text-xl font-semibold">Gemini API Key</h2>
        </div>
      )}
      
      <div className="relative">
        <input
          type={isSaved ? 'password' : 'text'}
          value={apiKey}
          onChange={handleKeyChange}
          placeholder="AIzaSy..."
          className={`w-full p-3 pr-10 rounded-lg bg-primary/50 border ${
            isValid === true 
              ? 'border-green-500/50 focus:ring-2 focus:ring-green-500/30' 
              : isValid === false 
                ? 'border-red-500/50 focus:ring-2 focus:ring-red-500/30' 
                : 'border-gray-600 focus:ring-2 focus:ring-accent/50'
          } focus:outline-none transition-all`}
          disabled={isSaved}
        />
        
        {apiKey && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <FiCheck className="text-green-500" />
            ) : isValid === false ? (
              <FiAlertCircle className="text-red-500" />
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-3 text-sm text-gray-400 flex items-start">
        <FiInfo className="mr-1.5 mt-0.5 flex-shrink-0" />
        <span>
          {isSaved 
            ? 'API key is saved. You can now use the app.'
            : 'Enter your Gemini API key to get started. Your key is stored locally.'}
          {' '}
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Get API key
          </a>
        </span>
      </div>

      <div className="mt-4 flex space-x-3">
        {!isSaved ? (
          <button
            onClick={handleSaveKey}
            disabled={!isValid || !apiKey}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/25 ${
              !isValid || !apiKey
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-600 active:scale-[0.99]'
            }`}
            title={!isValid || !apiKey ? 'Enter a valid API key' : 'Save API key'}
          >
            <FiCheck />
            <span>Save Key</span>
          </button>
        ) : (
          <button
            onClick={handleClearKey}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-400/20"
            title="Change API key"
          >
            <FiKey />
            <span>Change Key</span>
          </button>
        )}
      </div>
    </div>
  );
}
