import { Scene } from 'phaser';
import { gameState } from '../GameState';
import { Audio } from '../../audio';
import { COLORS, FONTS, FONT_STYLES } from '../Theme';

export class SettingsScene extends Scene {
  private sliders: { key: string; label: string; value: number; bar: Phaser.GameObjects.Rectangle; handle: Phaser.GameObjects.Container }[] = [];

  constructor() {
    super('SettingsScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.black, 0.85);
    overlay.setInteractive();

    const panelW = 400;
    const panelH = 320;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    const panel = this.add.rectangle(panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, COLORS.bgDarkNum, 0.98);
    panel.setStrokeStyle(2, COLORS.textSecondaryNum, 0.3);

    const headerText = this.add.text(panelX + panelW / 2, panelY + 24, 'CONFIGURAÇÕES', {
      ...FONT_STYLES.small,
      color: COLORS.textSecondary,
    }).setOrigin(0.5);

    const closeBtn = this.add.text(panelX + panelW - 20, panelY + 24, '✕', {
      fontFamily: FONTS.mono,
      fontSize: '18px',
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());

    const volumes = [
      { key: 'master' as const, label: 'MESTRE', value: Audio.volumes.master },
      { key: 'ambient' as const, label: 'AMBIENTE', value: Audio.volumes.ambient },
      { key: 'sfx' as const, label: 'EFEITOS', value: Audio.volumes.sfx },
      { key: 'voice' as const, label: 'VOZ', value: Audio.volumes.voice },
    ];

    this.sliders = [];
    const sliderW = panelW - 80;
    const sliderX = panelX + 40;
    let y = panelY + 60;

    for (const vol of volumes) {
      const label = this.add.text(sliderX, y, vol.label, {
        ...FONT_STYLES.label,
        color: COLORS.textSecondary,
      });

      const pctText = this.add.text(sliderX + sliderW, y, `${Math.round(vol.value * 100)}%`, {
        ...FONT_STYLES.tiny,
        color: COLORS.textMuted,
      }).setOrigin(1, 0);

      y += 20;

      const track = this.add.rectangle(sliderX + sliderW / 2, y + 6, sliderW, 8, 0x222222, 1);
      track.setStrokeStyle(1, COLORS.textFaintNum, 0.5);

      const barW = vol.value * sliderW;
      const bar = this.add.rectangle(sliderX + barW / 2, y + 6, barW, 8, COLORS.amberStroke, 0.6);

      const handle = this.add.container(sliderX + barW, y + 6);
      const handleCircle = this.add.circle(0, 0, 10, COLORS.amberStroke, 0.9);
      handleCircle.setStrokeStyle(2, COLORS.amberStroke, 0.5);
      handleCircle.setInteractive({ draggable: true });
      handle.add(handleCircle);

      handleCircle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
        const clamped = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderW);
        handle.x = clamped;
        const newVal = (clamped - sliderX) / sliderW;
        bar.width = newVal * sliderW;
        bar.x = sliderX + bar.width / 2;
        pctText.setText(`${Math.round(newVal * 100)}%`);
        Audio.setVolume(vol.key, newVal);
      });

      this.sliders.push({ key: vol.key, label: vol.label, value: vol.value, bar, handle });

      y += 30;
    }

    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  private close() {
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      this.scene.stop('SettingsScene');
    });
  }
}
