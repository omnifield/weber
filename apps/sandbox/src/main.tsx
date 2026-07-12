import '@weber/style/themes.css';
import { createRoot } from '@weber/engine';
import { registry } from '@weber-app/registry';
import { engine } from './engine';

engine.register(registry);

createRoot(() => <Widgets.Counter />);
