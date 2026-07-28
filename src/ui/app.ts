import { BOARD_SIZE, FLEET } from '../game/types';
import type { Coord, Difficulty, Ship } from '../game/types';
import { coordLabel, shipCells } from '../game/board';
import { Game } from '../game/engine';
import { describeBoard, describeLogEntry, transcript } from './render';

const AI_THINKING_MS = 550;

export interface AppOptions {
  readonly seed: number;
  readonly debug: boolean;
}

/**
 * Owns the DOM. Contains no game rules: it renders a snapshot and dispatches
 * actions back into the engine. See SPEC.md Section 8.
 */
export class App {
  private readonly game: Game;
  private focus: Coord = { row: 0, col: 0 };
  private hover: Coord | null = null;
  private aiTurnTimer: number | null = null;
  private announcement = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly options: AppOptions,
  ) {
    this.game = new Game(options.seed, 'normal');
    this.root.addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  // ------------------------------------------------------------------ actions

  private place(coord: Coord): void {
    if (this.game.placeNextShip(coord)) {
      this.announce(`Placed. ${this.pendingSummary()}`);
    } else {
      const reason = this.game.placementRejection(coord);
      this.announce(
        reason === 'overlap'
          ? 'That would overlap a ship already on the board.'
          : 'That ship would hang off the edge of the board.',
      );
    }
    this.render();
  }

  private fire(coord: Coord): void {
    // The engine refuses out-of-turn and repeat shots; this only guards the timer.
    if (!this.game.canFireAt(coord)) return;

    const result = this.game.fireAtAi(coord);
    if (!result) return;

    this.announce(describeLogEntry(this.game.snapshot().log.at(-1)!));
    this.render();

    if (this.game.snapshot().phase === 'over') return;
    this.scheduleAiTurn();
  }

  /**
   * The AI's reply is delayed so the player can read what happened. Input is
   * blocked by the engine for the whole window, not merely hidden. SPEC.md Section 5.
   */
  private scheduleAiTurn(): void {
    if (this.aiTurnTimer !== null) return;

    this.aiTurnTimer = window.setTimeout(() => {
      this.aiTurnTimer = null;
      if (!this.game.takeAiTurn()) return;
      this.announce(describeLogEntry(this.game.snapshot().log.at(-1)!));
      this.render();
    }, AI_THINKING_MS);
  }

  private startBattle(): void {
    if (this.game.startBattle()) {
      this.focus = { row: 0, col: 0 };
      this.announce('Battle started. You fire first.');
      this.render();
    }
  }

  private playAgain(): void {
    if (this.aiTurnTimer !== null) {
      window.clearTimeout(this.aiTurnTimer);
      this.aiTurnTimer = null;
    }
    this.game.reset();
    this.focus = { row: 0, col: 0 };
    this.hover = null;
    this.announce('New game. Place your ships.');
    this.render();
  }

  private announce(message: string): void {
    this.announcement = message;
  }

  private pendingSummary(): string {
    const next = this.game.nextShipToPlace;
    return next ? `Next: ${next.name}, ${next.length} cells.` : 'All ships placed.';
  }

  // ----------------------------------------------------------------- keyboard

  private onKeyDown = (event: KeyboardEvent): void => {
    const snapshot = this.game.snapshot();

    if (event.key.toLowerCase() === 'r' && snapshot.phase === 'placement') {
      event.preventDefault();
      this.game.toggleOrientation();
      this.announce(`Orientation: ${this.game.orientation}.`);
      this.render();
      return;
    }

    const deltas: Record<string, Coord> = {
      ArrowUp: { row: -1, col: 0 },
      ArrowDown: { row: 1, col: 0 },
      ArrowLeft: { row: 0, col: -1 },
      ArrowRight: { row: 0, col: 1 },
    };

    const delta = deltas[event.key];
    if (delta) {
      event.preventDefault();
      this.focus = {
        row: Math.min(BOARD_SIZE - 1, Math.max(0, this.focus.row + delta.row)),
        col: Math.min(BOARD_SIZE - 1, Math.max(0, this.focus.col + delta.col)),
      };
      this.render();
      this.focusActiveCell();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (snapshot.phase === 'placement') this.place(this.focus);
      else if (snapshot.phase === 'battle') this.fire(this.focus);
    }
  };

  private focusActiveCell(): void {
    const selector = `[data-focus-target="true"]`;
    this.root.querySelector<HTMLButtonElement>(selector)?.focus();
  }

  // ------------------------------------------------------------------ display

  private render(): void {
    const snapshot = this.game.snapshot();
    this.root.replaceChildren();

    this.root.append(this.header());
    if (this.options.debug) this.root.append(this.debugBanner());
    this.root.append(this.liveRegion());

    if (snapshot.phase === 'placement') this.root.append(this.placementControls());
    if (snapshot.phase === 'battle') this.root.append(this.battleStatus());
    if (snapshot.phase === 'over') this.root.append(this.resultPanel());

    this.root.append(this.boards());
    if (snapshot.phase !== 'placement') this.root.append(this.logPanel());
  }

  private header(): HTMLElement {
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'Battleship';

    const subtitle = document.createElement('p');
    subtitle.className = 'subtitle';
    subtitle.textContent = `You versus the computer. Seed ${this.game.seed}.`;

    header.append(title, subtitle);
    return header;
  }

  private debugBanner(): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'debug-banner';
    banner.textContent =
      'Debug mode: the AI fleet is shown below. Turn it off by removing ?debug=1 from the address.';
    return banner;
  }

  private liveRegion(): HTMLElement {
    const region = document.createElement('p');
    region.className = 'sr-only';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.textContent = this.announcement;
    return region;
  }

  private button(
    label: string,
    onClick: () => void,
    options: { primary?: boolean; disabled?: boolean; pressed?: boolean } = {},
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (options.primary) button.className = 'primary';
    if (options.disabled) button.disabled = true;
    if (options.pressed !== undefined) button.setAttribute('aria-pressed', String(options.pressed));
    button.addEventListener('click', onClick);
    return button;
  }

  private placementControls(): HTMLElement {
    const snapshot = this.game.snapshot();
    const panel = document.createElement('section');
    panel.className = 'panel';

    const heading = document.createElement('h2');
    heading.textContent = 'Place your fleet';

    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = this.game.allShipsPlaced
      ? 'All five ships placed. Ready when you are.'
      : `${this.pendingSummary()} Orientation: ${snapshot.orientation}.`;

    const pending = document.createElement('ul');
    pending.className = 'fleet-list';
    FLEET.forEach((shipClass, index) => {
      const item = document.createElement('li');
      item.textContent = `${shipClass.name} (${shipClass.length})`;
      if (index < snapshot.placedCount) item.classList.add('sunk');
      else if (index === snapshot.placedCount) item.classList.add('next');
      pending.append(item);
    });

    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.append(
      this.button(`Rotate (R) — now ${snapshot.orientation}`, () => {
        this.game.toggleOrientation();
        this.render();
      }),
      this.button('Random placement', () => {
        this.game.randomisePlacement();
        this.announce('Fleet placed at random.');
        this.render();
      }),
      this.button('Reset placement', () => {
        this.game.resetPlacement();
        this.announce('Placement cleared.');
        this.render();
      }),
    );

    const difficulty = document.createElement('div');
    difficulty.className = 'controls';
    const difficultyLabel = document.createElement('span');
    difficultyLabel.textContent = 'Difficulty:';
    difficulty.append(difficultyLabel);

    (['easy', 'normal'] as Difficulty[]).forEach((level) => {
      difficulty.append(
        this.button(
          level === 'easy' ? 'Easy' : 'Normal',
          () => {
            this.game.setDifficulty(level);
            this.announce(`Difficulty set to ${level}.`);
            this.render();
          },
          { pressed: snapshot.difficulty === level },
        ),
      );
    });

    const start = document.createElement('div');
    start.className = 'controls';
    start.append(
      this.button('Start battle', () => this.startBattle(), {
        primary: true,
        disabled: !this.game.allShipsPlaced,
      }),
    );

    panel.append(heading, status, pending, controls, difficulty, start);
    return panel;
  }

  private battleStatus(): HTMLElement {
    const snapshot = this.game.snapshot();
    const panel = document.createElement('section');
    panel.className = 'panel';

    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = snapshot.awaitingAi
      ? 'The AI is taking its shot…'
      : 'Your turn — click a cell on the enemy waters.';

    const detail = document.createElement('p');
    detail.className = 'subtitle';
    detail.style.margin = '0';
    detail.textContent = `Difficulty: ${snapshot.difficulty}. Your shots: ${snapshot.humanShots}. AI shots: ${snapshot.aiShots}.`;

    panel.append(status, detail);
    return panel;
  }

  private resultPanel(): HTMLElement {
    const snapshot = this.game.snapshot();
    const panel = document.createElement('section');
    panel.className = 'panel result';

    const heading = document.createElement('h2');
    heading.textContent = snapshot.winner === 'human' ? 'You win.' : 'The AI wins.';

    const detail = document.createElement('p');
    detail.textContent =
      snapshot.winner === 'human'
        ? `You sank the enemy fleet in ${snapshot.humanShots} shots.`
        : `The AI sank your fleet in ${snapshot.aiShots} shots.`;

    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.style.justifyContent = 'center';
    controls.append(this.button('Play again', () => this.playAgain(), { primary: true }));

    panel.append(heading, detail, controls);
    return panel;
  }

  private boards(): HTMLElement {
    const snapshot = this.game.snapshot();
    const wrapper = document.createElement('div');
    wrapper.className = 'boards';

    const previewCells =
      snapshot.phase === 'placement' && this.hover && this.game.nextShipToPlace
        ? shipCells(this.hover, this.game.nextShipToPlace.length, snapshot.orientation)
        : [];

    wrapper.append(
      this.boardPanel({
        title: 'Your waters',
        hint:
          snapshot.phase === 'placement'
            ? 'Click to place. Press R to rotate.'
            : "The AI's shots against you.",
        descriptors: describeBoard({
          view: snapshot.humanBoardView,
          ships: snapshot.humanShips,
          interactive: snapshot.phase === 'placement',
          boardName: 'Your waters',
          preview: this.hover
            ? { cells: previewCells, legal: this.game.canPlaceNext(this.hover) }
            : undefined,
        }),
        interactive: snapshot.phase === 'placement',
        onCell: (coord) => this.place(coord),
        onHover: (coord) => {
          if (snapshot.phase !== 'placement') return;
          this.hover = coord;
          this.render();
        },
        fleet: snapshot.humanFleetStatus,
      }),
      this.boardPanel({
        title: 'Enemy waters',
        hint:
          snapshot.phase === 'placement'
            ? 'Hidden until the battle starts.'
            : snapshot.awaitingAi
              ? 'Locked while the AI takes its turn.'
              : 'Click a cell to fire.',
        descriptors: describeBoard({
          view: snapshot.aiBoardView,
          // Ship positions are passed only when the debug flag is explicitly on.
          ships: this.options.debug ? this.game.revealAiBoard() : undefined,
          interactive: snapshot.phase === 'battle' && !snapshot.awaitingAi,
          boardName: 'Enemy waters',
        }),
        interactive: snapshot.phase === 'battle' && !snapshot.awaitingAi,
        onCell: (coord) => this.fire(coord),
        fleet: snapshot.aiFleetStatus,
      }),
    );

    return wrapper;
  }

  private boardPanel(config: {
    title: string;
    hint: string;
    descriptors: ReturnType<typeof describeBoard>;
    interactive: boolean;
    onCell: (coord: Coord) => void;
    onHover?: (coord: Coord) => void;
    fleet: readonly { name: string; length: number; sunk: boolean }[];
  }): HTMLElement {
    const section = document.createElement('section');
    section.className = 'board-wrap';

    const heading = document.createElement('h2');
    heading.textContent = config.title;

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = config.hint;

    const grid = document.createElement('div');
    grid.className = `board${config.interactive ? '' : ' inert'}`;
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', config.title);

    grid.append(this.gridLabel(''));
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      grid.append(this.gridLabel(String.fromCharCode(65 + col)));
    }

    config.descriptors.forEach((descriptor, index) => {
      if (index % BOARD_SIZE === 0) grid.append(this.gridLabel(String(descriptor.coord.row + 1)));

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = descriptor.classes.join(' ');
      cell.textContent = descriptor.text;
      cell.disabled = descriptor.disabled;
      cell.setAttribute('aria-label', descriptor.label);
      cell.dataset.cell = coordLabel(descriptor.coord);

      const isFocus =
        config.interactive &&
        descriptor.coord.row === this.focus.row &&
        descriptor.coord.col === this.focus.col;
      if (isFocus) cell.dataset.focusTarget = 'true';

      cell.addEventListener('click', () => config.onCell(descriptor.coord));
      if (config.onHover) {
        cell.addEventListener('mouseenter', () => config.onHover?.(descriptor.coord));
      }
      grid.append(cell);
    });

    const fleet = document.createElement('ul');
    fleet.className = 'fleet-list';
    fleet.style.marginTop = '0.6rem';
    for (const ship of config.fleet) {
      const item = document.createElement('li');
      item.textContent = `${ship.name} (${ship.length})`;
      if (ship.sunk) item.classList.add('sunk');
      fleet.append(item);
    }

    section.append(heading, hint, grid, fleet);
    return section;
  }

  private gridLabel(text: string): HTMLElement {
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = text;
    return label;
  }

  private logPanel(): HTMLElement {
    const snapshot = this.game.snapshot();
    const panel = document.createElement('section');
    panel.className = 'panel';

    const heading = document.createElement('h2');
    heading.textContent = 'Shot log';

    const list = document.createElement('ul');
    list.className = 'log';
    for (const entry of [...snapshot.log].reverse()) {
      const item = document.createElement('li');
      item.className = entry.side === 'ai' ? 'ai' : '';
      if (entry.outcome === 'sunk') item.classList.add('sunk-entry');
      item.textContent = describeLogEntry(entry);
      list.append(item);
    }

    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.style.marginTop = '0.6rem';
    controls.append(
      this.button('Copy log', () => {
        const text = transcript(snapshot.seed, snapshot.log);
        void navigator.clipboard?.writeText(text);
        this.announce('Shot log copied, including the seed.');
      }),
    );

    panel.append(heading, list, controls);
    return panel;
  }
}

/** Exposed for the debug view only; keeps `Ship` imported where it is used. */
export type DebugFleet = readonly Ship[];
