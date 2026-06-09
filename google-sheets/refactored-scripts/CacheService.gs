/**
 * CacheService.gs
 * Wrapper layer for the Google Apps Script script cache engine.
 */

const AppCacheService = {
  /**
   * Fetches parsed cache object.
   * @param {string} key Cache key.
   * @return {any|null} Deserialized value.
   */
  get(key) {
    try {
      const cache = CacheService.getScriptCache();
      const value = cache.get(key);
      if (value) {
        return JSON.parse(value);
      }
    } catch (e) {
      console.warn("Cache read failure for key: " + key, e);
    }
    return null;
  },

  /**
   * Saves serialized object to cache.
   * @param {string} key Cache key.
   * @param {any} value Value to save.
   * @param {number} ttl TTL in seconds.
   */
  put(key, value, ttl) {
    try {
      const cache = CacheService.getScriptCache();
      const jsonString = JSON.stringify(value);
      cache.put(key, jsonString, ttl);
    } catch (e) {
      console.error("Cache save failure for key: " + key, e);
    }
  },

  /**
   * Clears consolidated database cache key.
   */
  clear() {
    try {
      const cache = CacheService.getScriptCache();
      cache.remove(CONFIG.CACHE_KEY_APPS);
    } catch (e) {
      console.error("Cache clear failure", e);
    }
  }
};
