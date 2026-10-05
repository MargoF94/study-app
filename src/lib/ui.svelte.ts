// Screen state shared between components: view mode, handwriting tools and undo.
// Mode and pencil setting are remembered on this device only.
import type { InkColor, InkTool } from './types';
import { loadPref, savePref } from './util';

export type ViewMode = 'clean' | 'notes';
export type Tool = InkTool | 'eraser';

interface Step {
  undo: () => void;
  redo: () => void;
}

class Ui {
  mode = $state<ViewMode>(loadPref('mode', 'clean'));
  pencilOnly = $state<boolean>(loadPref('pencilOnly', true));
  writing = $state(false);
  tool = $state<Tool>('pen');
  penColor = $state<InkColor>('ink');
  markerColor = $state<InkColor>('yellow');

  #undo = $state<Step[]>([]);
  #redo = $state<Step[]>([]);
  canUndo = $derived(this.#undo.length > 0);
  canRedo = $derived(this.#redo.length > 0);

  get notes() {
    return this.mode === 'notes';
  }

  setMode(mode: ViewMode) {
    this.mode = mode;
    if (mode === 'clean') this.writing = false;
    savePref('mode', mode);
  }

  setPencilOnly(on: boolean) {
    this.pencilOnly = on;
    savePref('pencilOnly', on);
  }

  /** Writing only happens in Notes mode, so starting to write switches to it. */
  toggleWriting() {
    if (!this.writing) this.setMode('notes');
    this.writing = !this.writing;
  }

  get color(): InkColor {
    return this.tool === 'marker' ? this.markerColor : this.penColor;
  }

  setColor(c: InkColor) {
    if (this.tool === 'marker') this.markerColor = c;
    else {
      this.penColor = c;
      if (this.tool === 'eraser') this.tool = 'pen';
    }
  }

  record(step: Step) {
    this.#undo = [...this.#undo.slice(-99), step];
    this.#redo = [];
  }

  undo() {
    const step = this.#undo[this.#undo.length - 1];
    if (!step) return;
    this.#undo = this.#undo.slice(0, -1);
    this.#redo = [...this.#redo, step];
    step.undo();
  }

  redo() {
    const step = this.#redo[this.#redo.length - 1];
    if (!step) return;
    this.#redo = this.#redo.slice(0, -1);
    this.#undo = [...this.#undo, step];
    step.redo();
  }

  /** A new question: undo history belongs to the one before. */
  clearHistory() {
    this.#undo = [];
    this.#redo = [];
  }
}

export const ui = new Ui();
