import { Scene } from 'phaser';
import { gameState } from '../GameState';
import { Audio } from '../../audio';
import { COLORS, FONTS, FONT_STYLES, SCP } from '../Theme';

export class TerminalScene extends Scene {
  private documentData: { title: string; content: string[] } | null = null;
  private objId: string = '';
  private scrollY: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private maxScroll: number = 0;

  constructor() {
    super('TerminalScene');
  }

  init(data: { documentData?: { title: string; content: string[] } | null; objId?: string }) {
    this.documentData = data.documentData || null;
    this.objId = data.objId || '';
    this.scrollY = 0;
  }

  create() {
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.black, 0.85);
    overlay.setInteractive();

    const panelW = width * 0.7;
    const panelH = height * 0.75;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    const panel = this.add.rectangle(panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, COLORS.bgDarkNum, 0.98);
    panel.setStrokeStyle(2, SCP.keter.num, 0.4);

    const headerBg = this.add.rectangle(panelX + panelW / 2, panelY + 20, panelW, 40, 0x0a1a0a, 0.8);
    headerBg.setStrokeStyle(1, SCP.keter.num, 0.2);

    const headerText = this.add.text(panelX + 20, panelY + 20, 'TERMINAL', {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: SCP.keter.hex,
    }).setOrigin(0, 0.5);

    const closeBtn = this.add.text(panelX + panelW - 20, panelY + 20, '✕', {
      fontFamily: FONTS.mono,
      fontSize: '18px',
      color: SCP.keter.hex,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());

    this.contentContainer = this.add.container(panelX + 20, panelY + 50);

    if (this.documentData) {
      const titleText = this.add.text(0, 0, this.documentData.title, {
        fontFamily: FONTS.display,
        fontSize: '20px',
        color: SCP.keter.hex,
        wordWrap: { width: panelW - 40 },
      });

      let y = titleText.height + 16;
      this.contentContainer.add(titleText);

      const separator = this.add.rectangle(0, y, panelW - 40, 1, SCP.keter.num, 0.3);
      y += 16;
      this.contentContainer.add(separator);

      for (const paragraph of this.documentData.content) {
        const pText = this.add.text(0, y, paragraph, {
          ...FONT_STYLES.mono,
          color: '#aaaaaa',
          wordWrap: { width: panelW - 40 },
          lineSpacing: 4,
        });
        y += pText.height + 10;
        this.contentContainer.add(pText);
      }

      this.maxScroll = Math.max(0, y - panelH + 70);
    } else {
      const logs = gameState.terminalLogs;
      let y = 0;
      const last40 = logs.slice(-40);
      for (const log of last40) {
        const clean = log.replace(/\[color=[^\]]+\]/g, '').replace(/\[\/color\]/g, '');
        const colorMatch = log.match(/\[color=([^\]]+)\]/);
        const color = colorMatch ? colorMatch[1] : SCP.safe.hex;
        const logText = this.add.text(0, y, `> ${clean}`, {
          fontFamily: FONTS.mono,
          fontSize: '11px',
          color,
          wordWrap: { width: panelW - 40 },
          lineSpacing: 2,
        });
        y += logText.height + 4;
        this.contentContainer.add(logText);
      }
      this.maxScroll = Math.max(0, y - panelH + 70);
    }

    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objs: any[], _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScroll);
      this.contentContainer.setY(panelY + 50 - this.scrollY);
    });

    Audio.playTerminal();
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  private close() {
    Audio.stopSpeak();
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      this.scene.stop('TerminalScene');
    });
  }
}
