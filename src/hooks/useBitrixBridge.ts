import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Данные инициализации от Битрикс
 */
export interface BitrixInitData {
  offerIds: number[];
  sessid: string;
  apiBase: string;
  productId: number | null;
  iblockId: number | null;
}

/**
 * Типы сообщений от Битрикс
 */
type BitrixMessageType = 
  | 'BITRIX_INIT'
  | 'BITRIX_API_RESPONSE'
  | 'BITRIX_SAVE_SUCCESS'
  | 'BITRIX_SAVE_ERROR'
  | 'BITRIX_CONFIG_SAVED'
  | 'BITRIX_CONFIG_ERROR';

/**
 * Типы сообщений к Битрикс
 */
type CalcMessageType = 
  | 'CALC_READY'
  | 'CALC_CLOSE'
  | 'CALC_RESULT'
  | 'CALC_SAVE_CONFIG'
  | 'CALC_API_REQUEST'
  | 'CALC_ERROR';

interface ApiResponse {
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Хук для коммуникации с Битрикс через postMessage
 */
export function useBitrixBridge() {
  const [isInBitrix, setIsInBitrix] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [initData, setInitData] = useState<BitrixInitData | null>(null);
  const pendingRequests = useRef<Map<string, { resolve: (value?: any) => void; reject: (reason?: any) => void }>>(new Map());

  useEffect(() => {
    // Проверяем, находимся ли мы в iframe
    const inIframe = window.self !== window.top;
    
    // Функция для отправки сообщений родителю
    const sendToParent = (type: CalcMessageType, payload: any) => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type, payload }, '*');
      }
    };
    
    const handleMessage = (event: MessageEvent) => {
      // Валидация origin для безопасности
      // В production следует проверять на конкретный домен Битрикс
      // Для разработки принимаем любой origin
      // if (event.origin !== 'https://your-bitrix-domain.com') return;
      
      const data = event.data;
      
      if (!data || typeof data !== 'object' || !data.type) {
        return;
      }

      switch (data.type as BitrixMessageType) {
        case 'BITRIX_INIT':
          setIsInBitrix(true);
          setInitData(data.payload as BitrixInitData);
          setIsReady(true);
          console.log('[BitrixBridge] Initialized with data:', data.payload);
          break;
          
        case 'BITRIX_API_RESPONSE':
          const response = data.payload as ApiResponse;
          const pending = pendingRequests.current.get(response.requestId);
          if (pending) {
            pendingRequests.current.delete(response.requestId);
            if (response.success) {
              pending.resolve(response.data);
            } else {
              pending.reject(new Error(response.error || 'API request failed'));
            }
          }
          break;
          
        case 'BITRIX_SAVE_SUCCESS':
          console.log('[BitrixBridge] Save success:', data.payload);
          break;
          
        case 'BITRIX_SAVE_ERROR':
          console.error('[BitrixBridge] Save error:', data.payload);
          break;
          
        case 'BITRIX_CONFIG_SAVED':
          console.log('[BitrixBridge] Config saved:', data.payload);
          break;
          
        case 'BITRIX_CONFIG_ERROR':
          console.error('[BitrixBridge] Config error:', data.payload);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Если в iframe, сообщаем родителю что React готов
    if (inIframe) {
      sendToParent('CALC_READY', {});
    } else {
      // Если не в iframe (standalone режим), сразу готовы
      setIsReady(true);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  /**
   * Отправка сообщения родительскому окну
   */
  const sendToParent = useCallback((type: CalcMessageType, payload: any) => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, payload }, '*');
    }
  }, []);

  /**
   * Закрытие диалога
   */
  const closeDialog = useCallback(() => {
    sendToParent('CALC_CLOSE', {});
  }, [sendToParent]);

  /**
   * Отправка результата расчёта
   */
  const sendResult = useCallback((result: any) => {
    sendToParent('CALC_RESULT', result);
  }, [sendToParent]);

  /**
   * Сохранение конфигурации
   */
  const saveConfig = useCallback((config: any) => {
    sendToParent('CALC_SAVE_CONFIG', config);
  }, [sendToParent]);

  /**
   * Отправка ошибки
   */
  const sendError = useCallback((error: string) => {
    sendToParent('CALC_ERROR', { message: error });
  }, [sendToParent]);

  /**
   * API запрос через Битрикс (проксирование)
   */
  const apiRequest = useCallback(<T = any>(
    endpoint: string, 
    data?: Record<string, any>,
    method: 'GET' | 'POST' = 'GET'
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Сохраняем промис для ответа
      pendingRequests.current.set(requestId, { resolve, reject });
      
      // Таймаут на случай если ответ не придёт
      setTimeout(() => {
        if (pendingRequests.current.has(requestId)) {
          pendingRequests.current.delete(requestId);
          reject(new Error('API request timeout'));
        }
      }, 30000);
      
      // Отправляем запрос
      sendToParent('CALC_API_REQUEST', {
        requestId,
        endpoint,
        data,
        method
      });
    });
  }, [sendToParent]);

  /**
   * Получение списка калькуляторов
   */
  const getCalculators = useCallback(() => {
    return apiRequest<{ groups: any[]; calculators: any[] }>('calculators.php');
  }, [apiRequest]);

  /**
   * Получение элементов инфоблока
   */
  const getElements = useCallback((iblockCode: string, sectionId?: number) => {
    return apiRequest<any[]>('elements.php', { iblock_code: iblockCode, section_id: sectionId });
  }, [apiRequest]);

  /**
   * Получение оборудования
   */
  const getEquipment = useCallback(() => {
    return apiRequest<any[]>('equipment.php');
  }, [apiRequest]);

  /**
   * Выполнение расчёта
   */
  const calculate = useCallback((config: any) => {
    return apiRequest<any>('calculate.php', config, 'POST');
  }, [apiRequest]);

  return {
    // Состояние
    isInBitrix,
    isReady,
    initData,
    
    // Методы коммуникации
    closeDialog,
    sendResult,
    saveConfig,
    sendError,
    
    // API методы
    apiRequest,
    getCalculators,
    getElements,
    getEquipment,
    calculate
  };
}
