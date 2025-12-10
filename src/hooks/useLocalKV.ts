import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Простой заменитель useKV на localStorage.
 * Ключ хранится в localStorage как JSON.
 * Возвращает [value, setValue] совместимо с useState.
 */
export function useLocalKV<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : initialValue;
    } catch {
      return initialValue;
    }
  };

  const [state, setState] = useState<T>(read);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }, [key, state]);

  // Поддержка синхронизации между вкладками
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === key) {
        try {
          setState(e.newValue ? JSON.parse(e.newValue) as T : initialValue);
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, initialValue]);

  return [state, setState];
}
