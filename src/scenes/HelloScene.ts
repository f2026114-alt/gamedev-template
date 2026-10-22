import Phaser from 'phaser';

type Cell = [number, number];

type ShapeDefinition = {
  name: string;
  color: number;
  cells: Cell[];
};

type StageDefinition = {
  label: string;
  width: number;
  height: number;
  target: number;
};

type RankingEntry = {
  emptyCells: number;
  stageLabel: string;
  placedBlocks: number;
  date: string;
};

export class HelloScene extends Phaser.Scene {
  private readonly stagePresets: StageDefinition[] = [
    { label: '5×5', width: 5, height: 5, target: 9 },
    { label: '6×6', width: 6, height: 6, target: 10 },
    { label: '7×7', width: 7, height: 7, target: 13 },
    { label: '8×8', width: 8, height: 8, target: 13 },
    { label: '5×7', width: 5, height: 7, target: 10 },
    { label: '6×8', width: 6, height: 8, target: 12 },
  ];

  private readonly blockLibrary: ShapeDefinition[] = [
    { name: 'I', color: 0x38bdf8, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    { name: 'O', color: 0xfbbf24, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: 'T', color: 0xc084fc, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    { name: 'L', color: 0xfb923c, cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
    { name: 'J', color: 0x60a5fa, cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
    { name: 'S', color: 0x34d399, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { name: 'Z', color: 0xf87171, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { name: 'U', color: 0xf9a8d4, cells: [[0, 0], [2, 0], [0, 1], [2, 1]] },
  ];

  private board: Array<Array<number | null>> = [];
  private boardWidth = 5;
  private boardHeight = 5;
  private cellSize = 48;
  private boardX = 120;
  private boardY = 120;
  private currentPiece: ShapeDefinition | null = null;
  private nextPiece: ShapeDefinition | null = null;
  private currentX = 0;
  private currentY = 0;
  private placedBlocks = 0;
  private targetBlocks = 9;
  private previousPieceName: string | null = null;
  private gameOver = false;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private nextGraphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private rankingText!: Phaser.GameObjects.Text;
  private stageButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('HelloScene');
  }

  create(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x0f172a);
    this.add.rectangle(640, 360, 980, 620, 0x111827).setStrokeStyle(4, 0x7dd3fc, 1);

    this.add.text(120, 32, 'Fill the board', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      color: '#f8fafc',
      fontStyle: 'bold',
    });

    this.statusText = this.add.text(120, 620, 'Select a stage and fill the target count.', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#bfdbfe',
    });

    this.targetText = this.add.text(760, 120, 'Target: 9', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#fef3c7',
      fontStyle: 'bold',
    });

    this.rankingText = this.add.text(760, 300, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#e2e8f0',
      lineSpacing: 8,
    });

    this.boardGraphics = this.add.graphics();
    this.nextGraphics = this.add.graphics();

    this.createStageButtons();
    this.drawRanking();
    this.startStage(this.stagePresets[0]);
  }

  update(_time: number, _delta: number): void {
    if (this.gameOver || !this.currentPiece) {
      return;
    }

    const left = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const right = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    const up = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    const down = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    const space = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const enter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    if (Phaser.Input.Keyboard.JustDown(left)) {
      this.tryMove(-1, 0);
    }
    if (Phaser.Input.Keyboard.JustDown(right)) {
      this.tryMove(1, 0);
    }
    if (Phaser.Input.Keyboard.JustDown(up)) {
      this.tryMove(0, -1);
    }
    if (Phaser.Input.Keyboard.JustDown(down)) {
      this.tryMove(0, 1);
    }
    if (Phaser.Input.Keyboard.JustDown(space)) {
      this.rotateCurrent();
    }
    if (Phaser.Input.Keyboard.JustDown(enter)) {
      this.lockCurrentPiece();
    }

    if (this.checkNoMotionOrRotation()) {
      this.handleLose('No more movement or rotation for the current block.');
    }
  }

  private createStageButtons(): void {
    this.stageButtons.forEach((button) => button.destroy());
    this.stageButtons = [];

    this.add.text(760, 40, 'Stages', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#f8fafc',
      fontStyle: 'bold',
    });

    this.stagePresets.forEach((stage, index) => {
      const button = this.add.text(760 + (index % 2) * 130, 80 + Math.floor(index / 2) * 52, stage.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: index === 0 ? '#fef3c7' : '#e2e8f0',
        backgroundColor: index === 0 ? '#1f2937' : '#111827',
        padding: { x: 12, y: 8 },
      }).setInteractive();

      button.on('pointerdown', () => {
        this.startStage(stage);
      });

      this.stageButtons.push(button);
    });
  }

  private startStage(stage: StageDefinition): void {
    this.boardWidth = stage.width;
    this.boardHeight = stage.height;
    this.targetBlocks = stage.target;
    this.placedBlocks = 0;
    this.gameOver = false;
    this.board = Array.from({ length: this.boardHeight }, () => Array(this.boardWidth).fill(null));
    this.previousPieceName = null;
    this.nextPiece = this.randomBlock();
    this.currentPiece = null;
    this.spawnNextPiece();
    this.targetText.setText(`Target: ${stage.target}`);
    this.statusText.setText(`Stage: ${stage.label} — fill ${stage.target} blocks to win.`);
    this.stageButtons.forEach((button, index) => {
      const active = this.stagePresets[index].label === stage.label;
      button.setColor(active ? '#fef3c7' : '#e2e8f0');
      button.setBackgroundColor(active ? '#1f2937' : '#111827');
    });
    this.renderBoard();
    this.renderNextPreview();
  }

  private randomBlock(): ShapeDefinition {
    const pool = this.blockLibrary.filter((block) => block.name !== this.previousPieceName);
    const safePool = pool.length > 0 ? pool : this.blockLibrary;
    const selected = Phaser.Math.RND.pick(safePool);
    this.previousPieceName = selected.name;
    return selected;
  }

  private spawnNextPiece(): void {
    if (this.currentPiece) {
      return;
    }

    const current = this.nextPiece ?? this.randomBlock();
    this.nextPiece = this.randomBlock();
    this.currentPiece = { ...current, cells: current.cells.map(([x, y]) => [x, y]) };
    this.currentX = Math.max(0, Math.floor((this.boardWidth - this.getPieceWidth(this.currentPiece)) / 2));
    this.currentY = 0;

    if (!this.hasAnyValidPlacement(this.currentPiece)) {
      this.handleLose('The next block cannot be placed anywhere.');
    }

    this.renderBoard();
    this.renderNextPreview();
  }

  private getPieceWidth(piece: ShapeDefinition): number {
    return Math.max(...piece.cells.map(([x]) => x)) + 1;
  }

  private tryMove(dx: number, dy: number): void {
    if (!this.currentPiece || this.gameOver) {
      return;
    }

    const nextX = this.currentX + dx;
    const nextY = this.currentY + dy;

    if (this.isInsideBoard(this.currentPiece, nextX, nextY, true)) {
      this.currentX = nextX;
      this.currentY = nextY;
      this.renderBoard();
    }
  }

  private rotateCurrent(): void {
    if (!this.currentPiece || this.gameOver) {
      return;
    }

    const rotated = this.rotateCells(this.currentPiece.cells);
    const candidate = { ...this.currentPiece, cells: rotated };

    const offsets = [0, -1, 1, -2, 2];
    for (const offset of offsets) {
      const x = this.currentX + offset;
      if (this.isInsideBoard(candidate, x, this.currentY, true)) {
        this.currentPiece = candidate;
        this.currentX = x;
        this.renderBoard();
        return;
      }
    }
  }

  private rotateCells(cells: Cell[]): Cell[] {
    const maxY = Math.max(...cells.map(([, y]) => y));
    const rotated = cells.map(([x, y]) => [maxY - y, x] as Cell);
    return this.normalizeCells(rotated);
  }

  private normalizeCells(cells: Cell[]): Cell[] {
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    return cells.map(([x, y]) => [x - minX, y - minY] as Cell);
  }

  private lockCurrentPiece(): void {
    if (!this.currentPiece || this.gameOver) {
      return;
    }

    if (!this.isInsideBoard(this.currentPiece, this.currentX, this.currentY, false)) {
      return;
    }

    for (const [x, y] of this.currentPiece.cells) {
      const boardX = this.currentX + x;
      const boardY = this.currentY + y;
      this.board[boardY][boardX] = this.currentPiece.color;
    }

    this.placedBlocks += 1;
    this.currentPiece = null;

    if (this.placedBlocks >= this.targetBlocks) {
      this.handleWin();
      return;
    }

    this.spawnNextPiece();
    this.renderBoard();
    this.renderNextPreview();
  }

  private isInsideBoard(piece: ShapeDefinition, x: number, y: number, ignoreFixedBlocks: boolean): boolean {
    for (const [cellX, cellY] of piece.cells) {
      const boardX = x + cellX;
      const boardY = y + cellY;

      if (boardX < 0 || boardX >= this.boardWidth || boardY < 0 || boardY >= this.boardHeight) {
        return false;
      }

      if (!ignoreFixedBlocks && this.board[boardY][boardX] !== null) {
        return false;
      }
    }

    return true;
  }

  private hasAnyValidPlacement(piece: ShapeDefinition): boolean {
    for (let y = 0; y <= this.boardHeight - 1; y += 1) {
      for (let x = 0; x <= this.boardWidth - 1; x += 1) {
        if (this.canPlace(piece, x, y)) {
          return true;
        }
      }
    }

    return false;
  }

  private canPlace(piece: ShapeDefinition, x: number, y: number): boolean {
    for (const [cellX, cellY] of piece.cells) {
      const boardX = x + cellX;
      const boardY = y + cellY;

      if (boardX < 0 || boardX >= this.boardWidth || boardY < 0 || boardY >= this.boardHeight) {
        return false;
      }

      if (this.board[boardY][boardX] !== null) {
        return false;
      }
    }

    return true;
  }

  private checkNoMotionOrRotation(): boolean {
    if (!this.currentPiece || this.gameOver) {
      return false;
    }

    const moves = [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ];

    for (const [dx, dy] of moves) {
      if (this.isInsideBoard(this.currentPiece, this.currentX + dx, this.currentY + dy, true)) {
        return false;
      }
    }

    const rotated = this.rotateCells(this.currentPiece.cells);
    if (this.isInsideBoard({ ...this.currentPiece, cells: rotated }, this.currentX, this.currentY, true)) {
      return false;
    }

    return true;
  }

  private handleWin(): void {
    this.gameOver = true;
    const emptyCells = this.countEmptyCells();
    const ranking = this.loadRanking();
    ranking.push({
      emptyCells,
      stageLabel: `${this.boardWidth}×${this.boardHeight}`,
      placedBlocks: this.placedBlocks,
      date: new Date().toLocaleDateString('ja-JP'),
    });
    ranking.sort((a, b) => a.emptyCells - b.emptyCells);
    localStorage.setItem('cell-fill-ranking', JSON.stringify(ranking.slice(0, 10)));
    this.drawRanking();
    this.statusText.setText(`Win! Remaining empty cells: ${emptyCells}. Press R to restart.`);
    this.input.keyboard!.on('keydown-R', () => {
      this.startStage(this.stagePresets[0]);
    });
    this.renderBoard();
  }

  private handleLose(message: string): void {
    if (this.gameOver) {
      return;
    }

    this.gameOver = true;
    this.statusText.setText(`${message} You lose.`);
    this.input.keyboard!.on('keydown-R', () => {
      this.startStage(this.stagePresets[0]);
    });
  }

  private countEmptyCells(): number {
    let count = 0;
    for (let y = 0; y < this.boardHeight; y += 1) {
      for (let x = 0; x < this.boardWidth; x += 1) {
        if (this.board[y][x] === null) {
          count += 1;
        }
      }
    }
    return count;
  }

  private drawRanking(): void {
    const ranking = this.loadRanking();
    let display = 'Ranking\n';
    if (ranking.length === 0) {
      display += 'No records yet';
    } else {
      ranking.slice(0, 5).forEach((entry, index) => {
        display += `${index + 1}. ${entry.emptyCells} empty • ${entry.stageLabel}\n`;
      });
    }
    this.rankingText.setText(display);
  }

  private loadRanking(): RankingEntry[] {
    try {
      const raw = localStorage.getItem('cell-fill-ranking');
      return raw ? JSON.parse(raw) as RankingEntry[] : [];
    } catch {
      return [];
    }
  }

  private renderBoard(): void {
    this.boardGraphics.clear();

    for (let y = 0; y < this.boardHeight; y += 1) {
      for (let x = 0; x < this.boardWidth; x += 1) {
        const px = this.boardX + x * this.cellSize;
        const py = this.boardY + y * this.cellSize;
        const fill = this.board[y][x] ?? 0x0f172a;

        this.boardGraphics.fillStyle(fill, fill === 0x0f172a ? 0.95 : 1);
        this.boardGraphics.fillRect(px, py, this.cellSize, this.cellSize);
        this.boardGraphics.lineStyle(2, 0x475569, 1);
        this.boardGraphics.strokeRect(px, py, this.cellSize, this.cellSize);
      }
    }

    if (this.currentPiece) {
      for (const [offsetX, offsetY] of this.currentPiece.cells) {
        const px = this.boardX + (this.currentX + offsetX) * this.cellSize;
        const py = this.boardY + (this.currentY + offsetY) * this.cellSize;
        this.boardGraphics.fillStyle(this.currentPiece.color, 1);
        this.boardGraphics.fillRect(px + 4, py + 4, this.cellSize - 8, this.cellSize - 8);
        this.boardGraphics.lineStyle(2, 0xffffff, 0.4);
        this.boardGraphics.strokeRect(px + 4, py + 4, this.cellSize - 8, this.cellSize - 8);
      }
    }
  }

  private renderNextPreview(): void {
    this.nextGraphics.clear();
    const previewX = 820;
    const previewY = 170;
    const previewSize = 32;

    this.nextGraphics.fillStyle(0x111827, 1);
    this.nextGraphics.fillRoundedRect(previewX - 10, previewY - 10, 170, 170, 16);
    this.nextGraphics.lineStyle(2, 0x7dd3fc, 1);
    this.nextGraphics.strokeRoundedRect(previewX - 10, previewY - 10, 170, 170, 16);

    const piece = this.nextPiece ?? this.blockLibrary[0];
    const minX = Math.min(...piece.cells.map(([x]) => x));
    const maxX = Math.max(...piece.cells.map(([x]) => x));
    const minY = Math.min(...piece.cells.map(([, y]) => y));
    const maxY = Math.max(...piece.cells.map(([, y]) => y));
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const offsetX = previewX + Math.floor((4 - width) / 2) * previewSize;
    const offsetY = previewY + Math.floor((4 - height) / 2) * previewSize;

    for (const [x, y] of piece.cells) {
      const px = offsetX + (x - minX) * previewSize;
      const py = offsetY + (y - minY) * previewSize;
      this.nextGraphics.fillStyle(piece.color, 1);
      this.nextGraphics.fillRoundedRect(px + 3, py + 3, previewSize - 6, previewSize - 6, 6);
    }
  }
}
