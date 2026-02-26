// Web implementation for react-native-localize
// Uses browser Intl API for localization

// Get browser locale
const getBrowserLocale = () => {
  return navigator.language || 'en';
};

// Get all locales
const getLocales = () => {
  const locale = getBrowserLocale();
  return [
    {
      languageTag: locale,
      languageCode: locale.split('-')[0],
      countryCode: locale.split('-')[1] || '',
      isRTL: ['ar', 'he', 'fa', 'ur'].includes(locale.split('-')[0]),
    },
  ];
};

// Get timezone
const getTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'UTC';
  }
};

// Get country
const getCountry = () => {
  const locale = getBrowserLocale();
  return locale.split('-')[1] || '';
};

// Get language
const getLanguage = () => {
  const locale = getBrowserLocale();
  return locale.split('-')[0];
};

// Check if using metric system
const isMetric = () => {
  try {
    return Intl.NumberFormat().resolvedOptions().maximumFractionDigits === 3;
  } catch (e) {
    return true;
  }
};

// Get calendar
const getCalendar = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().calendar || 'gregorian';
  } catch (e) {
    return 'gregorian';
  }
};

// Get temperature unit
const getTemperatureUnit = () => {
  // Default to Celsius for most locales
  const locale = getBrowserLocale();
  const celsiusCountries = ['CN', 'JP', 'KR', 'HK', 'TW', 'AU', 'NZ'];
  const countryCode = locale.split('-')[1];

  if (celsiusCountries.includes(countryCode)) {
    return 'celsius';
  }
  return 'fahrenheit';
};

// Add event listener
const addEventListener = (eventName, handler) => {
  // Language change is rare, no real event in browser
  return { remove: () => {} };
};

// Remove event listener
const removeEventListener = () => {};

// Refresh (no-op for web)
const refresh = async () => {};

// Locale object
const locale = {
  country: getCountry(),
  isRTL: getLocales()[0].isRTL,
  languageCode: getLanguage(),
  languageTag: getBrowserLocale(),
  scriptCode: '',
};

// Export all functions
export {
  getLocales,
  getTimeZone,
  getCountry,
  getLanguage,
  isMetric,
  getCalendar,
  getTemperatureUnit,
  addEventListener,
  removeEventListener,
  refresh,
  locale,
};

export default {
  getLocales,
  getTimeZone,
  getCountry,
  getLanguage,
  isMetric,
  getCalendar,
  getTemperatureUnit,
  addEventListener,
  removeEventListener,
  refresh,
  locale,
};
