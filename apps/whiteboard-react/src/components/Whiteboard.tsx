import React, { useEffect, useRef } from 'react';
import { Canvas } from '@whiteboard/canvas-core';
import { whiteboardStore } from '@whiteboard/store';

export const Whiteboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize canvas
    canvasRef.current = new Canvas(containerRef.current);

    // Cleanup on unmount
    return () => {
      if (canvasRef.current) {
        canvasRef.current.destroy();
        canvasRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="whiteboard-container"
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    />
  );
};