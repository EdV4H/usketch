import React from 'react';
import { Whiteboard } from './components/Whiteboard';
import { Toolbar } from './components/Toolbar';
import './styles/App.css';

function App() {
  return (
    <div className="app">
      <Toolbar />
      <Whiteboard />
    </div>
  );
}

export default App;