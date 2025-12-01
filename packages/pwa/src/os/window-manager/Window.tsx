import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { useWindowStore, WindowData } from './windowStore'
import './Window.css'

interface WindowProps {
  window: WindowData
  children: React.ReactNode
}

export const Window: React.FC<WindowProps> = ({ window, children }) => {
  const dragControls = useDragControls()
  const windowRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 })
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 })

  const {
    focusWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    snapLeft,
    snapRight,
    updatePosition,
    updateSize,
  } = useWindowStore()

  // Calculate position and size based on state
  const getWindowStyle = useCallback((): React.CSSProperties => {
    const style: React.CSSProperties = {
      zIndex: window.zIndex,
    }

    switch (window.state) {
      case 'minimized':
        return {
          ...style,
          display: 'none',
        }
      case 'maximized':
        return {
          ...style,
          top: 0,
          left: 0,
          width: '100%',
          height: 'calc(100% - 70px)', // Account for dock
          borderRadius: 0,
        }
      case 'left':
        return {
          ...style,
          top: 0,
          left: 0,
          width: '50%',
          height: 'calc(100% - 70px)',
          borderRadius: 0,
        }
      case 'right':
        return {
          ...style,
          top: 0,
          left: '50%',
          width: '50%',
          height: 'calc(100% - 70px)',
          borderRadius: 0,
        }
      default:
        return {
          ...style,
          top: window.y,
          left: window.x,
          width: window.width,
          height: window.height,
        }
    }
  }, [window])

  const handleMouseDown = () => {
    focusWindow(window.id)
  }

  const handleDragEnd = (_: unknown, info: { point: { x: number; y: number } }) => {
    if (window.state === 'normal') {
      updatePosition(window.id, info.point.x, info.point.y)
    }
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeStartPos({ x: e.clientX, y: e.clientY })
    setResizeStartSize({ width: window.width, height: window.height })
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartPos.x
      const deltaY = e.clientY - resizeStartPos.y
      const newWidth = Math.max(400, resizeStartSize.width + deltaX)
      const newHeight = Math.max(300, resizeStartSize.height + deltaY)
      updateSize(window.id, newWidth, newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeStartPos, resizeStartSize, window.id, updateSize])

  const handleDoubleClickTitleBar = () => {
    maximizeWindow(window.id)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Keyboard shortcuts for window management
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          snapLeft(window.id)
          break
        case 'ArrowRight':
          e.preventDefault()
          snapRight(window.id)
          break
        case 'ArrowUp':
          e.preventDefault()
          maximizeWindow(window.id)
          break
      }
    }
  }, [window.id, snapLeft, snapRight, maximizeWindow])

  if (window.state === 'minimized') {
    return null
  }

  const canDrag = window.state === 'normal'

  return (
    <motion.div
      ref={windowRef}
      className={`os-window ${window.isActive ? 'active' : ''} ${window.state}`}
      style={getWindowStyle()}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      drag={canDrag}
      dragControls={dragControls}
      dragMomentum={false}
      dragListener={false}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
    >
      {/* Title Bar */}
      <div
        className="os-window-titlebar"
        onPointerDown={(e) => canDrag && dragControls.start(e)}
        onDoubleClick={handleDoubleClickTitleBar}
      >
        <div className="os-window-controls">
          <button
            className="os-window-control close"
            onClick={() => closeWindow(window.id)}
            title="Close"
          >
            ✕
          </button>
          <button
            className="os-window-control minimize"
            onClick={() => minimizeWindow(window.id)}
            title="Minimize"
          >
            −
          </button>
          <button
            className="os-window-control maximize"
            onClick={() => maximizeWindow(window.id)}
            title={window.state === 'maximized' ? 'Restore' : 'Maximize'}
          >
            {window.state === 'maximized' ? '❐' : '□'}
          </button>
        </div>
        <span className="os-window-title">{window.title}</span>
        <div className="os-window-snap-controls">
          <button
            className="os-window-snap"
            onClick={() => snapLeft(window.id)}
            title="Snap Left"
          >
            ◧
          </button>
          <button
            className="os-window-snap"
            onClick={() => snapRight(window.id)}
            title="Snap Right"
          >
            ◨
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="os-window-content">
        {children}
      </div>

      {/* Resize Handle (only for normal state) */}
      {window.state === 'normal' && (
        <div
          className="os-window-resize-handle"
          onMouseDown={startResize}
        />
      )}
    </motion.div>
  )
}
