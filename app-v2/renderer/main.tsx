import { createRoot } from 'react-dom/client';
import { AppRouter } from './router';

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<AppRouter />);
