import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Terminal } from './Terminal';
import { Admin } from './Admin';
import './styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode>{location.pathname.startsWith('/admin') ? <Admin /> : <Terminal />}</StrictMode>);
