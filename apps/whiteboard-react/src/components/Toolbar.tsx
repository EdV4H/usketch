import React from 'react';
import { whiteboardStore } from '@whiteboard/store';
import { useStore } from '../hooks/useStore';

export const Toolbar: React.FC = () => {
  const currentTool = useStore((state) => state.currentTool);
  const setCurrentTool = useStore((state) => state.setCurrentTool);

  const tools = [
    { id: 'select', name: 'Select', icon: '↖' },
    { id: 'rectangle', name: 'Rectangle', icon: '□' },
  ];

  return (
    <div className="toolbar">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`tool-button ${currentTool === tool.id ? 'active' : ''}`}
          onClick={() => setCurrentTool(tool.id)}
          title={tool.name}
        >
          <span className="tool-icon">{tool.icon}</span>
          <span className="tool-name">{tool.name}</span>
        </button>
      ))}
    </div>
  );
};