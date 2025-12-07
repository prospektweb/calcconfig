import { createContext, useContext, ReactNode } from 'react';
import { useBitrixBridge, BitrixInitData } from '@/hooks/useBitrixBridge';

interface BitrixContextValue {
  isInBitrix: boolean;
  isReady: boolean;
  initData: BitrixInitData | null;
  closeDialog: () => void;
  sendResult: (result: any) => void;
  saveConfig: (config: any) => void;
  sendError: (error: string) => void;
  apiRequest: <T = any>(endpoint: string, data?: Record<string, any>, method?: 'GET' | 'POST') => Promise<T>;
  getCalculators: () => Promise<{ groups: any[]; calculators: any[] }>;
  getElements: (iblockCode: string, sectionId?: number) => Promise<any[]>;
  getEquipment: () => Promise<any[]>;
  calculate: (config: any) => Promise<any>;
}

const BitrixContext = createContext<BitrixContextValue | null>(null);

export function BitrixProvider({ children }: { children: ReactNode }) {
  const bitrix = useBitrixBridge();
  
  return (
    <BitrixContext.Provider value={bitrix}>
      {children}
    </BitrixContext.Provider>
  );
}

export function useBitrix() {
  const context = useContext(BitrixContext);
  if (!context) {
    throw new Error('useBitrix must be used within a BitrixProvider');
  }
  return context;
}
