/**
 * Translation Service with Cache and Batching
 * - Cache translations to avoid re-translating same texts
 * - Batch multiple fields together for faster processing
 */

const translate = require("@iamtraction/google-translate");

// In-memory cache: key = "text|lang" => translatedText
const translationCache = new Map();

// Batch queue: collect requests to batch translate
let batchQueue = [];
let batchTimeout = null;
const BATCH_DELAY = 100; // ms - wait for more requests before sending

/**
 * Strip HTML tags into plain text, but preserve line breaks and add line breaks after sentences
 */
const stripHtml = (html) => {
  if (!html) return "";
  try {
    return String(html)
      .replace(/<br\s*\/?>/gi, '\n') // Preserve line breaks
      .replace(/<\/p>/gi, '\n') // Convert paragraph ends to line breaks
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\.\s+/g, '.\n') // Add line break after sentences (period followed by whitespace)
      .trim();
  } catch (e) {
    return String(html);
  }
};

/**
 * Generate cache key
 */
const getCacheKey = (text, language, options = {}) => {
  const optionsStr = JSON.stringify(options);
  return `${text}|${language}|${optionsStr}`;
};

/**
 * Check cache for translated text
 */
const getFromCache = (text, language, options = {}) => {
  const key = getCacheKey(text, language, options);
  return translationCache.get(key);
};

/**
 * Save to cache
 */
const saveToCache = (text, language, translatedText, options = {}) => {
  const key = getCacheKey(text, language, options);
  translationCache.set(key, translatedText);
};

/**
 * Translate single text with cache
 */
const translateSingleText = async (textToTranslate, targetLanguage, options = {}) => {
  if (!textToTranslate || textToTranslate.trim() === "") {
    return textToTranslate;
  }

  // Check cache first
  const cached = getFromCache(textToTranslate, targetLanguage, options);
  if (cached) {
    return cached;
  }

  try {
    // Call Google Translate API
    const translateOptions = {
      from: 'vi',
      to: targetLanguage,
      ...options
    };
    let result = await translate(textToTranslate, translateOptions);

    let translatedText = "";
    if (!result && typeof result === 'string') translatedText = result;
    else if (result && typeof result === 'string') translatedText = result;
    else if (result && result.translation) translatedText = result.translation;
    else if (result && result.text) translatedText = result.text;
    else if (result && result[0] && result[0].translatedText) translatedText = result[0].translatedText;
    else translatedText = String(result || textToTranslate);

    // Save to cache
    saveToCache(textToTranslate, targetLanguage, translatedText, options);

    return translatedText;
  } catch (error) {
    try {
      const msg = (error && error.message) ? error.message : String(error);
      // If the response was HTML (e.g. an error page) the JSON parser inside
      // the HTTP client may have thrown. Detect and log a concise message.
      if (msg.includes('<html') || msg.includes('Unexpected token')) {
        console.error('Translation service returned non-JSON (HTML) response. Returning original text.');
      } else {
        console.error('Error translating text:', msg);
      }
    } catch (e) {
      console.error('Error translating text: <unreadable error>');
    }

    return textToTranslate; // Return original on error
  }
};

/**
 * Translate multiple texts in batch
 * Groups same texts to translate only once
 */
const translateBatch = async (textsToTranslate, targetLanguage) => {
  if (!textsToTranslate || textsToTranslate.length === 0) {
    return [];
  }

  // Deduplicate texts - translate only unique values
  const uniqueTexts = [...new Set(textsToTranslate.filter(t => t && t.trim()))];
  
  if (uniqueTexts.length === 0) {
    return textsToTranslate.map(t => t || "");
  }

  // Check cache for all texts first
  const textToTranslate = [];
  const textToIndex = new Map(); // Map: index in uniqueTexts => cached result or null

  for (let i = 0; i < uniqueTexts.length; i++) {
    const text = uniqueTexts[i];
    const cached = getFromCache(text, targetLanguage);
    if (cached) {
      textToIndex.set(i, cached);
    } else {
      textToTranslate.push(text);
    }
  }

  // If all texts are cached, return immediately
  if (textToTranslate.length === 0) {
    return textsToTranslate.map(t => {
      const idx = uniqueTexts.indexOf(t);
      return textToIndex.get(idx) || t;
    });
  }

  // Translate remaining texts
  const translatedTexts = await Promise.all(
    textToTranslate.map(text => translateSingleText(text, targetLanguage))
  );

  // Map results back to original positions
  const results = [];
  let translatedIdx = 0;

  for (let i = 0; i < uniqueTexts.length; i++) {
    const text = uniqueTexts[i];
    if (textToIndex.has(i)) {
      results.push(textToIndex.get(i)); // cached
    } else {
      results.push(translatedTexts[translatedIdx]);
      translatedIdx++;
    }
  }

  // Map back to original array (with duplicates)
  return textsToTranslate.map(t => {
    const idx = uniqueTexts.indexOf(t);
    return results[idx] || t;
  });
};

/**
 * Translate ticket data with caching
 * Fields to translate:
 * - tinhTrang, phuongAnXuLy, phuongAnXuLyHtml, ketQua, ketQuaHtml
 * - khachHang, diaChi, nguoiLienHe, nguoiThucHien
 */
const translateTicketData = async (data, targetLanguage) => {
  if (!data || targetLanguage === "vi") {
    return data;
  }

  const fieldsToTranslate = [
    "tinhTrang",
    "phuongAnXuLy",
    "phuongAnXuLyHtml",
    "ketQua",
    "ketQuaHtml",
    "khachHang",
    "diaChi",
    "nguoiLienHe",
    "nguoiThucHien"
  ];

  const translatedData = { ...data };

  // Separate HTML and text fields
  const htmlFields = [];
  const textFields = [];

  for (const field of fieldsToTranslate) {
    if (!data[field] || typeof data[field] !== "string") continue;

    const isHtmlField = field.toLowerCase().endsWith('html');
    if (isHtmlField) {
      htmlFields.push({ field, text: stripHtml(data[field]) });
    } else {
      textFields.push({ field, text: data[field] });
    }
  }

  // Translate HTML fields (stripped to plain text with line breaks)
  if (htmlFields.length > 0) {
    for (const fieldInfo of htmlFields) {
      const lines = fieldInfo.text.split('\n').filter(line => line.trim());
      const translatedLines = await Promise.all(
        lines.map(line => translateSingleText(line.trim(), targetLanguage))
      );
      const translatedText = translatedLines.join('\n');
      // Convert line breaks back to <br> and wrap in div
      const htmlContent = translatedText
        .replace(/\n/g, '<br>')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      translatedData[fieldInfo.field] = `<div>${htmlContent}</div>`;
      // Also populate corresponding non-html field
      const nonHtmlKey = fieldInfo.field.replace(/Html$/i, '');
      if (nonHtmlKey && translatedData.hasOwnProperty(nonHtmlKey)) {
        translatedData[nonHtmlKey] = translatedText;
      }
    }
  }

  // Translate text fields normally
  if (textFields.length > 0) {
    const textTexts = textFields.map(f => f.text);
    const translatedTextTexts = await translateBatch(textTexts, targetLanguage);
    textFields.forEach((fieldInfo, idx) => {
      translatedData[fieldInfo.field] = translatedTextTexts[idx];
    });
  }

  return translatedData;
};

/**
 * Clear cache (useful for testing or memory management)
 */
const clearCache = () => {
  translationCache.clear();
};

/**
 * Get cache stats
 */
const getCacheStats = () => {
  return {
    size: translationCache.size,
    keys: Array.from(translationCache.keys())
  };
};

module.exports = {
  translateTicketData,
  translateSingleText,
  translateBatch,
  stripHtml,
  clearCache,
  getCacheStats,
  getFromCache,
  saveToCache
};
