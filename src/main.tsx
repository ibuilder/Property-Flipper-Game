import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
// Fonts first: the faces must be declared before anything that uses them.
import './ui/fonts.css';
import './ui/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
