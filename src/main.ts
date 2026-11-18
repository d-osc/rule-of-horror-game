import './ui.css';
import '@fontsource/ibm-plex-sans-thai/300.css';
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/500.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/libre-caslon-display/400.css';
import { HorrorGame } from './HorrorGame';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('Missing #game-canvas element.');
}

const game = new HorrorGame(canvas);
game.start();

import.meta.hot?.dispose(() => game.dispose());
