import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface ExchangeRateContextType {
  usdToKrwRate: number;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  error: string | null;
  refreshExchangeRate: () => Promise<void>;
  convertToKrw: (usd: number) => number;
  formatKrw: (usd: number) => string;
}

const ExchangeRateContext = createContext<ExchangeRateContextType | undefined>(undefined);

const STORAGE_KEY = 'culmore_usd_krw_exchange_rate';
const DEFAULT_FALLBACK_RATE = 1365.0; // Current market standard fallback
const ONE_HOUR_MS = 60 * 60 * 1000;

export const ExchangeRateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [usdToKrwRate, setUsdToKrwRate] = useState<number>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.rate === 'number' && parsed.rate > 0) {
          return parsed.rate;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return DEFAULT_FALLBACK_RATE;
  });

  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp) {
          return new Date(parsed.timestamp);
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRealtimeRate = useCallback(async (): Promise<number> => {
    // Primary API: open.er-api.com
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.rates && typeof data.rates.KRW === 'number') {
          return data.rates.KRW;
        }
      }
    } catch (err) {
      console.warn('Primary exchange rate API failed, attempting fallback...', err);
    }

    // Secondary Fallback API: Fawaz Ahmed Currency API via jsdelivr CDN
    try {
      const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.usd && typeof data.usd.krw === 'number') {
          return data.usd.krw;
        }
      }
    } catch (err) {
      console.warn('Fallback currency API failed:', err);
    }

    throw new Error('실시간 환율 서버에 연결할 수 없습니다. 직전 환율을 유지합니다.');
  }, []);

  const refreshExchangeRate = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const rate = await fetchRealtimeRate();
      const now = new Date();
      setUsdToKrwRate(rate);
      setLastUpdated(now);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rate,
          timestamp: now.toISOString(),
        })
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '환율 갱신 오류');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchRealtimeRate]);

  // Initial check on mount: fetch if stale (> 1 hour) or never updated
  useEffect(() => {
    const shouldFetchImmediately = !lastUpdated || (Date.now() - lastUpdated.getTime() > ONE_HOUR_MS);
    if (shouldFetchImmediately) {
      refreshExchangeRate();
    }

    // Setup 1-hour automatic recurring background refresh
    const interval = setInterval(() => {
      refreshExchangeRate();
    }, ONE_HOUR_MS);

    return () => clearInterval(interval);
  }, [lastUpdated, refreshExchangeRate]);

  const convertToKrw = useCallback((usd: number) => {
    return Math.round(usd * usdToKrwRate);
  }, [usdToKrwRate]);

  const formatKrw = useCallback((usd: number) => {
    const krw = Math.round(usd * usdToKrwRate);
    return `₩${krw.toLocaleString()}`;
  }, [usdToKrwRate]);

  return (
    <ExchangeRateContext.Provider
      value={{
        usdToKrwRate,
        lastUpdated,
        isRefreshing,
        error,
        refreshExchangeRate,
        convertToKrw,
        formatKrw,
      }}
    >
      {children}
    </ExchangeRateContext.Provider>
  );
};

export const useExchangeRate = () => {
  const context = useContext(ExchangeRateContext);
  if (!context) {
    throw new Error('useExchangeRate must be used within an ExchangeRateProvider');
  }
  return context;
};
