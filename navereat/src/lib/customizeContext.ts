import { createContext, useContext } from 'react';
import type { MenuItem } from '../data/demo';

export interface OpenCustomizeOptions {
  editKey?: string | null;
  editExisting?: boolean;
}

export interface CustomizeContextValue {
  openCustomize: (item: MenuItem, resId: number, options?: OpenCustomizeOptions) => void;
}

export const CustomizeContext = createContext<CustomizeContextValue | null>(null);

export function useCustomize(): CustomizeContextValue {
  const value = useContext(CustomizeContext);
  if (!value) throw new Error('useCustomize must be used inside CustomizeProvider');
  return value;
}
