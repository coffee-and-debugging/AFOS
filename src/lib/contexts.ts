import { createContext } from 'react';
import type { Restaurant } from '../types';

export const DEFAULT_RESTAURANT: Restaurant = {
  name: 'Yummy Foodland',
  tagline: '',
  currency: 'Rs.',
  address: '',
  phone: '',
  taxRate: 0,
  serviceChargeRate: 0,
  receiptFooter: '',
  qrBaseUrl: '',
  plan: 'pro',
};

export interface RestaurantContextValue {
  restaurant: Restaurant;
  setRestaurant: (r: Restaurant) => void;
  /** False until the real settings (including the plan) have arrived from the API */
  loaded: boolean;
}

export const RestaurantContext = createContext<RestaurantContextValue>({
  restaurant: DEFAULT_RESTAURANT,
  setRestaurant: () => {},
  loaded: false,
});

export interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
});
