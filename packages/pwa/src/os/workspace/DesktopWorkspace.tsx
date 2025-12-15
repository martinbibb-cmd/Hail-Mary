/**
 * DesktopWorkspace Component
 * 
 * Desktop layout for pointer:fine devices (mouse/trackpad).
 * Maintains the existing WIMP (Windows, Icons, Menus, Pointers) interface
 * with no changes to the desktop user experience.
 */

import React from 'react'
import { WindowManager } from '../window-manager'
import { Dock } from '../dock'
import { useCognitiveProfile } from '../../cognitive/CognitiveProfileContext'

interface DesktopWorkspaceProps {
  children: React.ReactNode
}

export const DesktopWorkspace: React.FC<DesktopWorkspaceProps> = ({ children }) => {
  const { profile } = useCognitiveProfile()
  const isFocusProfile = profile === 'focus'

  return (
    <>
      {/* Window Manager for OS-style windows */}
      <WindowManager />

      {/* macOS-style Dock at bottom */}
      {!isFocusProfile && <Dock />}

      {/* Main content with sidebar and routing */}
      {children}
    </>
  )
}
