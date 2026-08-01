import '@omnifield/weber-style/themes.css';
import { createRoot } from '@omnifield/weber-engine';
import { registry } from '@weber-app/registry';
import { engine } from './engine';

engine.register(registry);

createRoot(() => <Widgets.Counter />);
