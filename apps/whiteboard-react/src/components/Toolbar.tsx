import React from 'react';
import { whiteboardStore } from '@whiteboard/store';
import { useStore } from '../hooks/useStore';

export const Toolbar: React.FC = () => {
  const currentTool = useStore((state) => state.currentTool);
  const setCurrentTool = useStore((state) => state.setCurrentTool);

  const tools = [
    { id: 'select', name: 'Select' },
    { id: 'rectangle', name: 'Rectangle' },
  ];

  return (
    <div className="toolbar">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`tool-button ${currentTool === tool.id ? 'active' : ''}`}
          onClick={() => setCurrentTool(tool.id)}
        >
          {tool.name}
        </button>
      ))}
    </div>
  );
};