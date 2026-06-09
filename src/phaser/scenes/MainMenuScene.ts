import { Scene } from 'phaser';
import { Audio } from '../../audio';
import { COLORS, FONTS, FONT_STYLES, SCP } from '../Theme';

export class MainMenuScene extends Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    const { width, height } = this.cameras.main;

    const bg = this.add.image(width / 2, height / 2, 'bg_escritorio');
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);
    bg.setScale(scale).setAlpha(0.25);

    this.add.rectangle(width / 2, height / 2, width, height, COLORS.black, 0.7);

    this.add.text(width / 2, height * 0.25, 'MURPHY LAW', {
      ...FONT_STYLES.title,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.33, 'Investigações Privadas', {
      ...FONT_STYLES.subtitle,
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, height * 0.42, width * 0.6, 1, COLORS.amberStroke, 0.5);

    this.add.text(width / 2, height * 0.50, 'Um jogo noir de detetive.\nMurphy Law, cansado e sem rumo,\naceita o caso de uma mãe desesperada.', {
      ...FONT_STYLES.body,
      color: '#aaaaaa',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);

    const btnBg = this.add.rectangle(width / 2, height * 0.72, 320, 56, COLORS.bgCardNum, 1);
    btnBg.setStrokeStyle(2, COLORS.amberStroke);
    btnBg.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(width / 2, height * 0.72, 'ACEITAR O CASO', {
      ...FONT_STYLES.button,
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(COLORS.bgHoverNum, 1);
      btnText.setColor(COLORS.amberBright);
    });

    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(COLORS.bgCardNum, 1);
      btnText.setColor(COLORS.amber);
    });

    btnBg.on('pointerdown', () => {
      Audio.init();
      Audio.startAmbient();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start('GameScene');
      });
    });

    this.add.text(width / 2, height * 0.92, 'SCP: Quebra de Contenção', {
      fontFamily: FONTS.mono,
      fontSize: '12px',
      color: COLORS.textDim,
    }).setOrigin(0.5);

    this.cameras.main.fadeIn(1000, 0, 0, 0);
  }
}
