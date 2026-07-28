import { BOARD_SIZE } from '../game/types';
import type { CellView, Coord, LogEntry, Ship } from '../game/types';
import { cellsOf, coordKey, coordLabel } from '../game/board';

export interface CellDescriptor {
  readonly coord: Coord;
  readonly classes: string[];
  readonly text: string;
  readonly label: string;
  readonly disabled: boolean;
}

const OUTCOME_TEXT: Record<CellView, string> = {
  unknown: '',
  miss: '·',
  hit: '✕',
  sunk: '✕',
};

const OUTCOME_WORD: Record<CellView, string> = {
  unknown: 'not yet fired at',
  miss: 'miss',
  hit: 'hit',
  sunk: 'sunk',
};

/**
 * Build one board's worth of cell descriptors.
 *
 * `ships` is only ever passed for a board the viewer is entitled to see. The AI's
 * board is rendered from its `view` alone, so no ship position reaches the DOM.
 */
export function describeBoard(options: {
  view: readonly CellView[][];
  ships?: readonly Ship[];
  interactive: boolean;
  boardName: string;
  preview?: { cells: readonly Coord[]; legal: boolean };
}): CellDescriptor[] {
  const { view, ships, interactive, boardName, preview } = options;

  const shipCells = new Set((ships ?? []).flatMap(cellsOf).map(coordKey));
  const previewCells = new Set((preview?.cells ?? []).map(coordKey));

  const descriptors: CellDescriptor[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const coord = { row, col };
      const key = coordKey(coord);
      const state = view[row][col];
      const classes = ['cell', state];

      if (shipCells.has(key) && state === 'unknown') classes.push('ship');
      if (previewCells.has(key)) classes.push(preview?.legal ? 'preview-ok' : 'preview-bad');

      const shipHere = shipCells.has(key) ? ', your ship' : '';
      descriptors.push({
        coord,
        classes,
        text: OUTCOME_TEXT[state],
        label: `${boardName} ${coordLabel(coord)}, ${OUTCOME_WORD[state]}${shipHere}`,
        disabled: !interactive || state !== 'unknown',
      });
    }
  }
  return descriptors;
}

export function describeLogEntry(entry: LogEntry): string {
  const who = entry.side === 'human' ? 'You fired' : 'AI fired';
  const at = coordLabel(entry.coord);

  if (entry.outcome === 'sunk') {
    return entry.side === 'human'
      ? `${who} ${at} — sunk! You sank my ${entry.sunkShip}.`
      : `${who} ${at} — sunk! It sank your ${entry.sunkShip}.`;
  }
  return `${who} ${at} — ${entry.outcome}.`;
}

/** The whole log as plain text, prefixed with the seed, for reproducible bug reports. */
export function transcript(seed: number, log: readonly LogEntry[]): string {
  const header = `Battleship transcript — seed ${seed}`;
  const shots = log.map((entry, index) => `${index + 1}. ${describeLogEntry(entry)}`);
  return [header, ...shots].join('\n');
}
