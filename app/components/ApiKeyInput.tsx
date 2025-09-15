import { useState, useEffect, ChangeEvent } from "react";
import { FiKey, FiCheck, FiAlertCircle, FiChevronDown } from "react-icons/fi";
import toast from "react-hot-toast";
import * as CryptoJS from "crypto-js";
import {
  SUPPORTED_MODELS,
  getSelectedModel,
  saveSelectedModel,
  ModelId,
} from "../utils/modelConfig";
import { SECRET_KEY } from "../utils/config";
import { decryptSafe } from "../utils/cryptoUtils";

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

  // Generate a consistent IV based on the secret key
  const getIV = (key: string) => {
    // Use the first 16 bytes of the SHA256 hash of the key as IV
    return CryptoJS.SHA256(key).toString().substring(0, 16);
  };

  useEffect(() => {
    const loadSavedKey = () => {
      // Only run on client side
      if (typeof window === "undefined") return;

      const savedKey = localStorage.getItem("API_KEY");
      if (!savedKey) return;

      try {
        // First try to decrypt with the current key
        try {
          const iv = getIV(SECRET_KEY);
          const result = decryptSafe(
            savedKey,
            SECRET_KEY,
            iv,
            CryptoJS.mode.CBC,
            CryptoJS.pad.Pkcs7
          );

          // If decryption succeeds and there's a plaintext, trust the stored key without re-validating.
          // Validation is enforced when the user first saves the key.
          if (result.ok && result.plaintext) {
            setApiKey(result.plaintext);
            setIsValid(true);
            setIsSaved(true);
            onKeyVerified(true);
            return;
          } else if (!result.ok) {
            console.warn("Decryption failed:", result.reason);
          }
        } catch {
          console.warn(
            "Failed to decrypt with current key, trying fallback..."
          );
        }

        // If we get here, decryption failed - try with the hardcoded fallback key
        const FALLBACK_KEY = "uJioow3SoPYeAG3iEBRGlSAdFMi8C10AfZVrw3X_4dg=";
        if (SECRET_KEY !== FALLBACK_KEY) {
          try {
            const iv = getIV(FALLBACK_KEY);
            const result = decryptSafe(
              savedKey,
              FALLBACK_KEY,
              iv,
              CryptoJS.mode.CBC,
              CryptoJS.pad.Pkcs7
            );

            if (result.ok && result.plaintext) {
              // Re-encrypt with the new key for next time
              const newIv = getIV(SECRET_KEY);
              const encrypted = CryptoJS.AES.encrypt(
                result.plaintext,
                SECRET_KEY,
                {
                  iv: CryptoJS.enc.Utf8.parse(newIv),
                  mode: CryptoJS.mode.CBC,
                  padding: CryptoJS.pad.Pkcs7,
                }
              );
              localStorage.setItem("API_KEY", encrypted.toString());

              setApiKey(result.plaintext);
              setIsValid(true);
              setIsSaved(true);
              onKeyVerified(true);
              return;
            } else if (!result.ok) {
              console.warn("Fallback decryption failed:", result.reason);
            }
          } catch {
            console.warn("Failed to decrypt with fallback key");
          }
        }

        // If we get here, decryption failed with both keys
        console.error("Failed to decrypt API key with any available key");
        toast.error("Failed to load saved API key. Please enter it again.");
        localStorage.removeItem("API_KEY");
      } catch (error) {
        console.error("Error loading saved API key:", error);
        toast.error("Error loading saved API key. Please enter it again.");
        localStorage.removeItem("API_KEY");
      }
    };

    loadSavedKey();

    const savedModel = getSelectedModel();
    setSelectedModel(savedModel);
    if (onModelChange) onModelChange(savedModel);
  }, [onModelChange, onKeyVerified]);

  const validateApiKey = (key: string): boolean => {
    // Relaxed validation to accommodate potential key format changes by Google.
    // Accepts keys starting with AIza and with a reasonable length.
    const pattern = /^AIza[0-9A-Za-z\-_]{20,100}$/;
    return pattern.test(key);
  };

  const handleKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    setApiKey(key);
    setIsValid(key ? validateApiKey(key) : null);
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
      const iv = getIV(SECRET_KEY);
      const encrypted = CryptoJS.AES.encrypt(apiKey, SECRET_KEY, {
        iv: CryptoJS.enc.Utf8.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      localStorage.setItem("API_KEY", encrypted.toString());
      setIsValid(true);
      setIsSaved(true);
      onKeyVerified(true);
      toast.success("API key saved successfully!");
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key. Please try again.");
    }
  };

  const handleModelSelect = (modelId: ModelId) => {
    setSelectedModel(modelId);
    saveSelectedModel(modelId);
    setIsModelDropdownOpen(false);
    if (onModelChange) onModelChange(modelId);
    const model = SUPPORTED_MODELS.find((m) => m.id === modelId);
    toast.success(`Model set to: ${model?.name || modelId}`);
  };

  const handleClearKey = () => {
    localStorage.removeItem("API_KEY");
    setApiKey("");
    setIsValid(null);
    setIsSaved(false);
    onKeyVerified(false);
    toast.success("API key cleared");
  };

  const currentModel = SUPPORTED_MODELS.find((m) => m.id === selectedModel);

  return (
    <div
      className={`bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-lg ${className}`}
    >
      {showTitle && (
        <div className="flex items-center mb-4">
          <FiKey className="text-blue-600 dark:text-blue-400 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Gemini API Key & Model
          </h2>
        </div>
      )}

      <div className="mb-4">
        <label
          htmlFor="model-select"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Model
        </label>
        <div className="relative">
          <button
            id="model-select"
            type="button"
            className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-left flex items-center justify-between text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            aria-haspopup="listbox"
            aria-expanded={isModelDropdownOpen}
          >
            <span>{currentModel?.name || "Select a model"}</span>
            <FiChevronDown
              className={`transition-transform text-gray-500 dark:text-gray-400 ${
                isModelDropdownOpen ? "transform rotate-180" : ""
              }`}
            />
          </button>
          {isModelDropdownOpen && (
            <div
              className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg"
              role="listbox"
            >
              {SUPPORTED_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={selectedModel === model.id}
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
        <label
          htmlFor="api-key-input"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          API Key
        </label>
        <input
          id="api-key-input"
          type={isSaved ? "password" : "text"}
          value={apiKey}
          onChange={handleKeyChange}
          placeholder="Enter your Gemini API key (AIzaSy...)"
          className={`w-full p-3 pr-10 rounded-lg bg-white dark:bg-gray-900/30 border h-12 ${
            isValid === true
              ? "border-green-500/50 focus:ring-2 focus:ring-green-500/30"
              : isValid === false
              ? "border-red-500/50 focus:ring-2 focus:ring-red-500/30"
              : "border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/30"
          } focus:outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
          disabled={isSaved}
          aria-invalid={isValid === false}
          aria-describedby="api-key-status"
        />

        <div
          id="api-key-status"
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 mt-3"
          aria-live="polite"
        >
          {isValid === true && (
            <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <FiCheck
                className="w-3.5 h-3.5 text-green-600 dark:text-green-400"
                aria-label="API key is valid"
              />
            </div>
          )}
          {isValid === false && (
            <FiAlertCircle
              className="w-4 h-4 text-red-500"
              aria-label="API key is invalid"
            />
          )}
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-start">
        <FiAlertCircle className="mr-1.5 mt-0.5 flex-shrink-0" />
        <span>
          {isSaved
            ? "API key is saved. You can now use the app."
            : "Your key is stored locally and never sent to our servers."}{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Get a Gemini API key
          </a>
          .
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
              <span className="text-sm font-medium">API Key Saved</span>
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
