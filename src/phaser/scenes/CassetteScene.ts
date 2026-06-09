import { Scene } from 'phaser';
import { gameState } from '../GameState';
import { PHONE_CONTACTS } from '../../data';
import { COLORS, FONTS, FONT_STYLES, SCP } from '../Theme';

export class CassetteScene extends Scene {
  private scrollY: number = 0;
  private maxScroll: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private panelX: number = 0;
  private panelY: number = 0;
  private panelW: number = 0;
  private panelH: number = 0;

  constructor() {
    super('CassetteScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.black, 0.85);
    overlay.setInteractive();

    this.panelW = width * 0.65;
    this.panelH = height * 0.8;
    this.panelX = (width - this.panelW) / 2;
    this.panelY = (height - this.panelH) / 2;

    const panel = this.add.rectangle(
      this.panelX + this.panelW / 2,
      this.panelY + this.panelH / 2,
      this.panelW, this.panelH, COLORS.bgDarkNum, 0.98
    );
    panel.setStrokeStyle(2, COLORS.amberStroke, 0.4);

    const headerBg = this.add.rectangle(
      this.panelX + this.panelW / 2,
      this.panelY + 20,
      this.panelW, 40, 0x1a1a0a, 0.8
    );
    headerBg.setStrokeStyle(1, COLORS.amberStroke, 0.2);

    const headerText = this.add.text(this.panelX + 20, this.panelY + 20, 'FITA CASSETE', {
      ...FONT_STYLES.small,
      color: COLORS.amber,
    }).setOrigin(0, 0.5);

    const closeBtn = this.add.text(this.panelX + this.panelW - 20, this.panelY + 20, '✕', {
      fontFamily: FONTS.mono,
      fontSize: '18px',
      color: COLORS.amber,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());

    this.contentContainer = this.add.container(this.panelX + 20, this.panelY + 50);
    this.renderMenu();

    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objs: any[], _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScroll);
      this.contentContainer.setY(this.panelY + 50 - this.scrollY);
    });

    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  private renderMenu() {
    this.contentContainer.removeAll(true);
    this.scrollY = 0;
    this.contentContainer.setY(this.panelY + 50);

    const recordings = Object.entries(gameState.phoneRecordings);
    let y = 0;

    if (recordings.length === 0) {
      const empty = this.add.text(0, 20, 'Nenhuma gravação ainda.\nUse o telefone para gravar conversas.', {
        ...FONT_STYLES.mono,
        color: COLORS.textDim,
        lineSpacing: 4,
      });
      this.contentContainer.add(empty);
      this.maxScroll = 0;
      return;
    }

    for (const [contactId, lines] of recordings) {
      const contact = PHONE_CONTACTS[contactId];
      const name = contact?.name || contactId;
      const murphyNotes = gameState.murphyCommentaryMap[contactId] || [];

      const row = this.add.container(0, y);

      const bg = this.add.rectangle(this.panelW / 2 - 20, 20, this.panelW - 40, 44, COLORS.bgCardNum, 0.9);
      bg.setStrokeStyle(1, COLORS.amberStroke, 0.2);
      bg.setInteractive({ useHandCursor: true });

      const nameText = this.add.text(12, 10, `▶ ${name}`, {
        ...FONT_STYLES.monoAmber,
      });

      const lineCount = this.add.text(12, 28, `${lines.length} trechos gravados`, {
        ...FONT_STYLES.tiny,
        color: COLORS.textSecondary,
      });

      row.add([bg, nameText, lineCount]);

      bg.on('pointerover', () => bg.setFillStyle(COLORS.bgHoverNum, 0.9));
      bg.on('pointerout', () => bg.setFillStyle(COLORS.bgCardNum, 0.9));
      bg.on('pointerdown', () => {
        this.renderPlayback(contactId, lines, murphyNotes);
      });

      this.contentContainer.add(row);
      y += 52;
    }

    this.maxScroll = Math.max(0, y - this.panelH + 70);
  }

  private renderPlayback(
    contactId: string,
    lines: { speaker: string; lines: string[] }[],
    murphyNotes: string[]
  ) {
    this.contentContainer.removeAll(true);
    this.scrollY = 0;
    this.contentContainer.setY(this.panelY + 50);

    const contact = PHONE_CONTACTS[contactId];
    const name = contact?.name || contactId;

    let y = 0;

  const backBg = this.add.rectangle(60, 14, 120, 28, COLORS.bgCardNum, 0.9);
  backBg.setStrokeStyle(1, COLORS.textSecondaryNum, 0.3);
  backBg.setInteractive({ useHandCursor: true });
  const backText = this.add.text(60, 14, '← Voltar', {
    ...FONT_STYLES.label,
    color: COLORS.textSecondary,
  }).setOrigin(0.5);

  this.contentContainer.add([backBg, backText]);
  backBg.on('pointerover', () => backBg.setFillStyle(COLORS.bgHoverNum, 0.9));
  backBg.on('pointerout', () => backBg.setFillStyle(COLORS.bgCardNum, 0.9));
    backBg.on('pointerdown', () => this.renderMenu());

    y += 36;

  const title = this.add.text(0, y, `Gravação: ${name}`, {
    ...FONT_STYLES.small,
    color: COLORS.amber,
  });
  this.contentContainer.add(title);
  y += 24;

  const separator = this.add.rectangle(0, y, this.panelW - 40, 1, COLORS.amberStroke, 0.2);
    this.contentContainer.add(separator);
    y += 12;

    for (const entry of lines) {
      const speaker = this.add.text(0, y, `${entry.speaker}:`, {
        ...FONT_STYLES.monoAmber,
        fontSize: '11px',
      });
      this.contentContainer.add(speaker);
      y += 16;

      for (const line of entry.lines) {
        const lineText = this.add.text(12, y, line, {
          ...FONT_STYLES.mono,
          fontSize: '11px',
          fontStyle: 'italic',
          wordWrap: { width: this.panelW - 64 },
          lineSpacing: 3,
        });
        this.contentContainer.add(lineText);
        y += lineText.height + 4;
      }
      y += 8;
    }

    if (murphyNotes.length > 0) {
      y += 8;
      const noteSep = this.add.rectangle(0, y, this.panelW - 40, 1, SCP.safe.num, 0.2);
      this.contentContainer.add(noteSep);
      y += 8;

      const noteTitle = this.add.text(0, y, 'Notas de Murphy:', {
        ...FONT_STYLES.monoGreen,
        fontSize: '11px',
      });
      this.contentContainer.add(noteTitle);
      y += 18;

      for (const note of murphyNotes) {
        const noteText = this.add.text(12, y, `• ${note}`, {
          ...FONT_STYLES.monoGreen,
          fontSize: '11px',
          wordWrap: { width: this.panelW - 64 },
          lineSpacing: 3,
        });
        this.contentContainer.add(noteText);
        y += noteText.height + 4;
      }
    }

    this.maxScroll = Math.max(0, y - this.panelH + 70);
  }

  private close() {
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      this.scene.stop('CassetteScene');
    });
  }
}
