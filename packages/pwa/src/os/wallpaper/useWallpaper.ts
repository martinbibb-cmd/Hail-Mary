/**
 * Wallpaper Manager for Hail-Mary OS
 * 
 * Manages user-selectable wallpapers with localStorage persistence.
 * Supports built-in gradients and custom uploaded images.
 */

import { create } from 'zustand';
import { useAuth } from '../../auth';
import { useEffect, useCallback } from 'react';

export interface Wallpaper {
  id: string;
  name: string;
  type: 'gradient' | 'custom';
  className?: string;  // CSS class for gradient wallpapers
  imageUrl?: string;   // URL for custom wallpapers
  preview: string;     // CSS for preview thumbnail
}

// Built-in wallpaper presets
export const builtInWallpapers: Wallpaper[] = [
  {
    id: 'default',
    name: 'Deep Space',
    type: 'gradient',
    className: 'wallpaper-default',
    preview: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    type: 'gradient',
    className: 'wallpaper-aurora',
    preview: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    type: 'gradient',
    className: 'wallpaper-sunset',
    preview: 'linear-gradient(135deg, #ee7752 0%, #e73c7e 50%, #23a6d5 100%)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    type: 'gradient',
    className: 'wallpaper-ocean',
    preview: 'linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)',
  },
  {
    id: 'forest',
    name: 'Forest',
    type: 'gradient',
    className: 'wallpaper-forest',
    preview: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    type: 'gradient',
    className: 'wallpaper-midnight',
    preview: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  },
  {
    id: 'rose',
    name: 'Rose',
    type: 'gradient',
    className: 'wallpaper-rose',
    preview: 'linear-gradient(135deg, #360033 0%, #0b8793 100%)',
  },
  {
    id: 'ember',
    name: 'Ember',
    type: 'gradient',
    className: 'wallpaper-ember',
    preview: 'linear-gradient(135deg, #200122 0%, #6f0000 100%)',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    type: 'gradient',
    className: 'wallpaper-lavender',
    preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'mint',
    name: 'Mint',
    type: 'gradient',
    className: 'wallpaper-mint',
    preview: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  },
];

interface WallpaperStore {
  currentWallpaper: Wallpaper;
  customWallpapers: Wallpaper[];
  setWallpaper: (wallpaper: Wallpaper) => void;
  addCustomWallpaper: (imageUrl: string, name: string) => Wallpaper;
  removeCustomWallpaper: (id: string) => void;
  loadFromStorage: (userId: number) => void;
}

const getStorageKey = (userId: number) => `hailmary_wallpaper_${userId}`;
const getCustomStorageKey = (userId: number) => `hailmary_custom_wallpapers_${userId}`;

export const useWallpaperStore = create<WallpaperStore>((set, get) => ({
  currentWallpaper: builtInWallpapers[0],
  customWallpapers: [],
  
  setWallpaper: (wallpaper: Wallpaper) => {
    set({ currentWallpaper: wallpaper });
  },
  
  addCustomWallpaper: (imageUrl: string, name: string) => {
    const newWallpaper: Wallpaper = {
      id: `custom-${Date.now()}`,
      name,
      type: 'custom',
      imageUrl,
      preview: `url(${imageUrl})`,
    };
    set(state => ({
      customWallpapers: [...state.customWallpapers, newWallpaper],
    }));
    return newWallpaper;
  },
  
  removeCustomWallpaper: (id: string) => {
    const { currentWallpaper, customWallpapers } = get();
    // If removing the current wallpaper, reset to default
    if (currentWallpaper.id === id) {
      set({
        currentWallpaper: builtInWallpapers[0],
        customWallpapers: customWallpapers.filter(w => w.id !== id),
      });
    } else {
      set({
        customWallpapers: customWallpapers.filter(w => w.id !== id),
      });
    }
  },
  
  loadFromStorage: (userId: number) => {
    try {
      // Load custom wallpapers
      const customData = localStorage.getItem(getCustomStorageKey(userId));
      const customWallpapers: Wallpaper[] = customData ? JSON.parse(customData) : [];
      
      // Load current wallpaper preference
      const savedId = localStorage.getItem(getStorageKey(userId));
      let currentWallpaper = builtInWallpapers[0];
      
      if (savedId) {
        // Check built-in wallpapers first
        const builtIn = builtInWallpapers.find(w => w.id === savedId);
        if (builtIn) {
          currentWallpaper = builtIn;
        } else {
          // Check custom wallpapers
          const custom = customWallpapers.find(w => w.id === savedId);
          if (custom) {
            currentWallpaper = custom;
          }
        }
      }
      
      set({ currentWallpaper, customWallpapers });
    } catch (error) {
      console.error('Failed to load wallpaper from storage:', error);
    }
  },
}));

/**
 * Hook to use wallpaper with automatic persistence
 */
export function useWallpaper() {
  const { user } = useAuth();
  const {
    currentWallpaper,
    customWallpapers,
    setWallpaper: setWallpaperStore,
    addCustomWallpaper,
    removeCustomWallpaper,
    loadFromStorage,
  } = useWallpaperStore();
  
  // Load from storage when user changes
  useEffect(() => {
    if (user?.id) {
      loadFromStorage(user.id);
    }
  }, [user?.id, loadFromStorage]);
  
  // Save to storage when wallpaper changes
  const setWallpaper = useCallback((wallpaper: Wallpaper) => {
    setWallpaperStore(wallpaper);
    if (user?.id) {
      localStorage.setItem(getStorageKey(user.id), wallpaper.id);
    }
  }, [user?.id, setWallpaperStore]);
  
  // Save custom wallpapers when they change
  useEffect(() => {
    if (user?.id && customWallpapers.length > 0) {
      localStorage.setItem(getCustomStorageKey(user.id), JSON.stringify(customWallpapers));
    }
  }, [user?.id, customWallpapers]);
  
  // Get the CSS for the current wallpaper
  const getWallpaperStyle = useCallback((): React.CSSProperties => {
    if (currentWallpaper.type === 'custom' && currentWallpaper.imageUrl) {
      return {
        backgroundImage: `url(${currentWallpaper.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    return {};
  }, [currentWallpaper]);
  
  // Get the CSS class for gradient wallpapers
  const getWallpaperClass = useCallback((): string => {
    if (currentWallpaper.type === 'gradient' && currentWallpaper.className) {
      return currentWallpaper.className;
    }
    return '';
  }, [currentWallpaper]);
  
  return {
    currentWallpaper,
    customWallpapers,
    allWallpapers: [...builtInWallpapers, ...customWallpapers],
    setWallpaper,
    addCustomWallpaper,
    removeCustomWallpaper,
    getWallpaperStyle,
    getWallpaperClass,
  };
}
