import { useEffect, useState, useCallback, FC } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UseStoreageProps {
  key: string;
}

export const useStorage = (key: any) => {
  const [isStorageLoading, setLoading] = useState(true);
  const [value, setValue] = useState(null);

  const parseStringifiedValue = useCallback((string) => {
    if (string === null || string === undefined || string === '') {
      return null;
    }

    switch (string) {
      case 'true':
        return true;
      case 'false':
        return false;

      default:
        return JSON.parse(string);
    }
  }, []);

  async function setStorage(val) {
    setLoading(true);
    try {
      const formattedValue = JSON.stringify(val);
      await AsyncStorage.setItem(key, formattedValue);
      const getValue = await AsyncStorage.getItem(key);
      setValue(parseStringifiedValue(getValue));
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function getInitialValue() {
      setLoading(true);
      try {
        const initialValue = await AsyncStorage.getItem(key);
        setValue(parseStringifiedValue(initialValue));
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    }

    getInitialValue();
  }, [key, parseStringifiedValue]);

  return { isStorageLoading, value, setStorage };
};
