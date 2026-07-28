import './ui/styles.css';
import { App } from './ui/app';
import { randomSeed } from './game/rng';

function readOptions(): { seed: number; debug: boolean } {
  const params = new URLSearchParams(window.location.search);
  const requested = Number(params.get('seed'));

  return {
    seed: Number.isFinite(requested) && params.has('seed') ? requested : randomSeed(),
    debug: params.get('debug') === '1',
  };
}

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

// The game instance lives inside this module's scope only. Nothing is attached to
// `window`, so the AI's fleet is not reachable from the browser console.
new App(root, readOptions());
