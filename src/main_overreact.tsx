import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine, Device } from '@overreact/engine';
import App from './overreact/App';
import './index.css';
import './styles/scp.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Engine>
      <Device showFPS bg="#0a0a0a">
        <App />
      </Device>
    </Engine>
  </StrictMode>
);
