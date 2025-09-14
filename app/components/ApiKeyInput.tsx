"use client";

import { useState, useEffect } from "react";
import {
  FiKey,
  FiCheck,
  FiAlertCircle,
  FiInfo,
  FiChevronDown,
} from "react-icons/fi";
import toast from "react-hot-toast";
import * as CryptoJS from "crypto-js";
import {
  SUPPORTED_MODELS,
  getSelectedModel,
  saveSelectedModel,
  ModelId,
} from "../utils/modelConfig";

const SECRET_KEY = "uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=";

interface ApiKeyInputProps {
  onKeyVerified: (isVerified: boolean) => void;
  className?: string;
  showTitle?: boolean;
  onModelChange?: (modelId: ModelId) => void;
}

export default function ApiKeyInput({
  onKeyVerified,
  className = "",
  showTitle = true,
  onModelChange,
}: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState("");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>(
    getSelectedModel()
  );
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Check for saved API key and model on component mount
  useEffect(() => {
    const savedKey = localStorage.getItem("gemini-api-key");
    if (savedKey) {
      try {
        const decryptedKey = CryptoJS.AES.decrypt(
          savedKey,
          SECRET_KEY
        ).toString(CryptoJS.enc.Utf8);
        if (decryptedKey) {
          setApiKey(decryptedKey);
          setIsValid(true);
          setIsSaved(true);
        }
      } catch (error) {
        console.error("Error loading saved API key:", error);
      }
    }

    // Load saved model
    const savedModel = getSelectedModel();
    setSelectedModel(savedModel);
    if (onModelChange) onModelChange(savedModel);
  }, [onModelChange]);

  const validateApiKey = (key: string): boolean => {
    // Basic pattern check for Gemini API key
    const pattern = /^AIza[0-9A-Za-z\-_]{35}$/;
    return pattern.test(key);
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    setApiKey(key);

    if (key === "") {
      setIsValid(null);
    } else {
      setIsValid(validateApiKey(key));
    }
  };

  const handleSaveKey = () => {
    if (!apiKey) {
      toast.error("Please enter an API key");
      return;
    }

    if (!validateApiKey(apiKey)) {
      toast.error("Please enter a valid Gemini API key");
      return;
    }

    try {
      // Encrypt and save the key
      const encryptedKey = CryptoJS.AES.encrypt(apiKey, SECRET_KEY).toString();
      localStorage.setItem("gemini-api-key", encryptedKey);
      setIsSaved(true);
      onKeyVerified(true);
      toast.success("API key saved successfully!");
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    }
  };

  const handleModelSelect = (modelId: ModelId) => {
    setSelectedModel(modelId);
    saveSelectedModel(modelId);
    setIsModelDropdownOpen(false);
    if (onModelChange) onModelChange(modelId);
    toast.success(
      `Model set to: ${SUPPORTED_MODELS.find((m) => m.id === modelId)?.name}`
    );
  };

  const handleClearKey = () => {
    localStorage.removeItem("gemini-api-key");
    setApiKey("");
    setIsValid(null);
    setIsSaved(false);
    onKeyVerified(false);
    toast.success("API key cleared");
  };

  return (
    <div
      className={`bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-lg ${className}`}
    >
      {showTitle && (
        <div className="flex items-center mb-4">
          <FiKey className="text-blue-600 dark:text-blue-400 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Gemini API Key
          </h2>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Model
        </label>
        <div className="relative">
          <button
            type="button"
            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-left flex items-center justify-between text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          >
            <span>
              {SUPPORTED_MODELS.find((m) => m.id === selectedModel)?.name}
            </span>
            <FiChevronDown
              className={`transition-transform text-gray-500 dark:text-gray-400 ${
                isModelDropdownOpen ? "transform rotate-180" : ""
              }`}
            />
          </button>
          {isModelDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
              {SUPPORTED_MODELS.map((model) => (
                <button
                  key={model.id}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                    selectedModel === model.id
                      ? "bg-blue-50 dark:bg-blue-900/30"
                      : ""
                  }`}
                  onClick={() => handleModelSelect(model.id)}
                >
                  <div className="font-medium">{model.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {model.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          API Key
        </label>
        <input
          type={isSaved ? "password" : "text"}
          value={apiKey}
          onChange={handleKeyChange}
          placeholder="AIzaSy..."
          className={`w-full p-3 pr-10 rounded-lg bg-white dark:bg-gray-900/30 border h-12 ${
            isValid === true
              ? "border-green-500/50 focus:ring-2 focus:ring-green-500/30"
              : isValid === false
              ? "border-red-500/50 focus:ring-2 focus:ring-red-500/30"
              : "border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/30"
          } focus:outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
          disabled={isSaved}
        />

        {apiKey && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5">
            {isValid ? (
              <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <FiCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              </div>
            ) : isValid === false ? (
              <FiAlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <FiInfo className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            )}
          </div>
        )}
      </div>

      <div className="mt-3 text-sm text-gray-400 flex items-start">
        <FiInfo className="mr-1.5 mt-0.5 flex-shrink-0" />
        <span>
          {isSaved
            ? "API key is saved. You can now use the app."
            : "Enter your Gemini API key to get started. Your key is stored locally."}{" "}
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

      <div className="mt-6 flex items-center gap-3">
        {!isSaved ? (
          <button
            onClick={handleSaveKey}
            disabled={!apiKey || !isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Save Key
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
              <FiCheck className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">API key saved</span>
            </div>
            <button
              onClick={handleClearKey}
              className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              title="Change API key"
            >
              <FiKey className="w-4 h-4" />
              <span>Change</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
