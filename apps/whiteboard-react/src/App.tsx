import React from 'react';
import { Whiteboard } from './components/Whiteboard';
import { Toolbar } from './components/Toolbar';
import './styles/App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Whiteboard - React</h1>
      </header>
      <main className="app-main">
        <Toolbar />
        <Whiteboard />
      </main>
    </div>
  );
}

export default App;