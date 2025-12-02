/**
 * Desktop Component
 * 
 * Main desktop container that applies the selected wallpaper
 * and manages the overall OS shell layout.
 */

import React from 'react';
import { useWallpaper } from '../wallpaper';
import './Desktop.css';

interface DesktopProps {
  children: React.ReactNode;
}

export const Desktop: React.FC<DesktopProps> = ({ children }) => {
  const { currentWallpaper, getWallpaperStyle, getWallpaperClass } = useWallpaper();
  
  const wallpaperClass = getWallpaperClass();
  const wallpaperStyle = getWallpaperStyle();
  
  return (
    <div 
      className={`os-desktop ${wallpaperClass}`}
      style={wallpaperStyle}
      data-wallpaper={currentWallpaper.id}
    >
      {children}
    </div>
  );
};
