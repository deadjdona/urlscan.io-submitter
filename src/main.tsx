/**
 * React Application Entry Point
 * 
 * Bootstraps the urlscan-submitter React application by:
 * 1. Creating a React root in the #root DOM element
 * 2. Wrapping the App component in StrictMode for development warnings
 * 3. Loading global styles from index.css
 * 
 * The App component provides the main tabbed UI interface for URL scanning,
 * dataset exploration, and documentation viewing.
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Mount the React application to the DOM
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
