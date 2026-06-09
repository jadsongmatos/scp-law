import { Scene } from 'phaser';
import { gameState, DEDUCTION_LOCATIONS, DEDUCTION_CATEGORIES, HINT_VALUES, DeductionCategory } from '../GameState';
import { Audio } from '../../audio';
import { COLORS, FONTS, FONT_STYLES, SCP } from '../Theme';

const DEDUCTION_ACCENT = SCP.thaumiel;

const CATEGORY_OPTIONS: Record<DeductionCategory, string[]> = {
  suspeito: ['Dra. Cunha', 'Zeca do Gasthof', 'Seu Jonas', 'Diretora Elvira', 'Kommissar Mendes'],
  local: ['Gasthof Vila Nova', 'Volkspolizeistation 8', 'Volksschule Vila Nova', 'Beco da Rua Sieben', 'Lagerhaus 7'],
  arma: ['Chave Inglesa', 'Arame de Piano', 'Faca de Cozinha', 'Revolver .38', 'Veneno Injetável'],
  motivo: ['Extorsão', 'Tráfico de Crianças', 'Vingança Pessoal', 'Dívida de Jogo', 'Cobertura de Crime'],
  horario: ['04:00', '02:30', '01:00', '23:30', '22:00'],
};

const CATEGORY_LABELS: Record<DeductionCategory, string> = {
  suspeito: 'SUSPEITO',
  local: 'LOCAL',
  arma: 'ARMA',
  motivo: 'MOTIVO',
  horario: 'HORÁRIO',
};

export class DeductionScene extends Scene {
  private scrollY: number = 0;
  private maxScroll: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private panelX: number = 0;
  private panelY: number = 0;
  private panelW: number = 0;
  private panelH: number = 0;

  constructor() {
    super('DeductionScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.black, 0.85);
    overlay.setInteractive();

    this.panelW = Math.min(width * 0.9, 1100);
    this.panelH = height * 0.85;
    this.panelX = (width - this.panelW) / 2;
    this.panelY = (height - this.panelH) / 2;

    const panel = this.add.rectangle(
      this.panelX + this.panelW / 2,
      this.panelY + this.panelH / 2,
      this.panelW, this.panelH, COLORS.bgDarkNum, 0.98
    );
    panel.setStrokeStyle(2, DEDUCTION_ACCENT.num, 0.4);

    const headerBg = this.add.rectangle(
      this.panelX + this.panelW / 2,
      this.panelY + 20,
      this.panelW, 40, 0x0a0a1a, 0.8
    );
    headerBg.setStrokeStyle(1, DEDUCTION_ACCENT.num, 0.2);

    const headerText = this.add.text(this.panelX + 20, this.panelY + 20, ' quadro de dedução', {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: DEDUCTION_ACCENT.hex,
    }).setOrigin(0, 0.5);

    const closeBtn = this.add.text(this.panelX + this.panelW - 20, this.panelY + 20, '✕', {
      fontFamily: FONTS.mono,
      fontSize: '18px',
      color: DEDUCTION_ACCENT.hex,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());

    this.contentContainer = this.add.container(this.panelX + 20, this.panelY + 50);
    this.renderGrid();

    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objs: any[], _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScroll);
      this.contentContainer.setY(this.panelY + 50 - this.scrollY);
    });

    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  private renderGrid() {
    this.contentContainer.removeAll(true);
    this.scrollY = 0;
    this.contentContainer.setY(this.panelY + 50);

    const colW = (this.panelW - 40) / (DEDUCTION_CATEGORIES.length + 1);
    let y = 0;

    const headerRow = this.add.container(0, y);
  const locHeader = this.add.text(0, 0, 'LOCAL', {
    fontFamily: FONTS.mono,
    fontSize: '11px',
    color: DEDUCTION_ACCENT.hex,
  });
  headerRow.add(locHeader);

  DEDUCTION_CATEGORIES.forEach((cat, i) => {
    const catText = this.add.text((i + 1) * colW, 0, CATEGORY_LABELS[cat], {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: DEDUCTION_ACCENT.hex,
    });
      headerRow.add(catText);
    });
    this.contentContainer.add(headerRow);
    y += 24;

    const separator = this.add.rectangle(0, y, this.panelW - 40, 1, DEDUCTION_ACCENT.num, 0.2);
    this.contentContainer.add(separator);
    y += 8;

    for (const loc of DEDUCTION_LOCATIONS) {
      const row = this.add.container(0, y);

      const locText = this.add.text(0, 8, loc, {
      ...FONT_STYLES.label,
      color: COLORS.amber,
      wordWrap: { width: colW - 8 },
    });
      row.add(locText);

      DEDUCTION_CATEGORIES.forEach((cat, ci) => {
        const currentVal = gameState.deductionGrid[loc]?.[cat] || '';
        const options = CATEGORY_OPTIONS[cat];
        const currentIdx = options.indexOf(currentVal);

      const cellBg = this.add.rectangle((ci + 1) * colW + colW / 2, 16, colW - 8, 30, COLORS.bgCardNum, 0.9);
      cellBg.setStrokeStyle(1, COLORS.textFaintNum, 0.3);
      cellBg.setInteractive({ useHandCursor: true });

      const discovered = this.isValueDiscovered(cat, currentVal);
      const cellText = this.add.text((ci + 1) * colW + colW / 2, 16, currentVal || '—', {
        ...FONT_STYLES.tiny,
        color: currentVal ? (discovered ? SCP.safe.hex : COLORS.textPrimary) : '#444444',
      }).setOrigin(0.5);

        row.add([cellBg, cellText]);

        cellBg.on('pointerdown', () => {
          const nextIdx = (currentIdx + 1) % (options.length + 1);
          const newVal = nextIdx < options.length ? options[nextIdx] : '';
          gameState.deductionGrid[loc] = gameState.deductionGrid[loc] || {} as any;
          (gameState.deductionGrid[loc] as any)[cat] = newVal;

          const disc = this.isValueDiscovered(cat, newVal);
          cellText.setText(newVal || '—');
          cellText.setColor(newVal ? (disc ? SCP.safe.hex : COLORS.textPrimary) : '#444444');
          Audio.playTypewriter();
        });

      cellBg.on('pointerover', () => cellBg.setFillStyle(0x2a1a2a, 0.9));
      cellBg.on('pointerout', () => cellBg.setFillStyle(COLORS.bgCardNum, 0.9));
      });

      this.contentContainer.add(row);
      y += 36;
    }

    y += 16;

    const submitBg = this.add.rectangle(this.panelW / 2 - 20, y + 18, 200, 36, 0x1a0a1a, 0.9);
    submitBg.setStrokeStyle(2, DEDUCTION_ACCENT.num, 0.6);
    submitBg.setInteractive({ useHandCursor: true });
    const submitText = this.add.text(this.panelW / 2 - 20, y + 18, 'SUBMETER', {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: DEDUCTION_ACCENT.hex,
    }).setOrigin(0.5);
    this.contentContainer.add([submitBg, submitText]);

    submitBg.on('pointerover', () => submitBg.setFillStyle(0x2a0a2a, 0.9));
    submitBg.on('pointerout', () => submitBg.setFillStyle(0x1a0a1a, 0.9));
    submitBg.on('pointerdown', () => {
      this.submitDeduction();
    });

    y += 50;

    if (gameState.deductionResult === 'wrong') {
      const wrongText = this.add.text(this.panelW / 2 - 20, y, 'DEDUÇÃO INCORRETA — Tente novamente.', {
      ...FONT_STYLES.monoRed,
    }).setOrigin(0.5);
      this.contentContainer.add(wrongText);
      y += 24;
    }

    this.maxScroll = Math.max(0, y - this.panelH + 70);
  }

  private isValueDiscovered(cat: DeductionCategory, value: string): boolean {
    if (!value) return false;
    const hints = HINT_VALUES[cat]?.[value];
    if (!hints) return false;
    return hints.some(h => gameState.readHints.has(h));
  }

  private submitDeduction() {
    const result = gameState.checkDeduction();

    if (result === 'correct') {
      Audio.playPickup();
      gameState.addTerminalLog('[DEDUÇÃO] Solução correta! Caso resolvido.', SCP.safe.hex);
      this.time.delayedCall(500, () => {
        this.scene.launch('GameOverScene');
        this.close();
      });
    } else if (result === 'incomplete') {
      Audio.playDenied();
      gameState.addTerminalLog('[DEDUÇÃO] Preencha todos os campos.', SCP.keter.hex);
    } else {
      Audio.playDenied();
      gameState.addTerminalLog('[DEDUÇÃO] Dedução incorreta. Reveja as pistas.', SCP.keter.hex);
    }

    this.renderGrid();
  }

  private close() {
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      this.scene.stop('DeductionScene');
    });
  }
}
