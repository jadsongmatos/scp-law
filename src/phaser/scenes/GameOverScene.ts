import { Scene } from 'phaser';
import { gameState } from '../GameState';
import { COLORS, FONTS, FONT_STYLES, SCP } from '../Theme';

export class GameOverScene extends Scene {
  constructor() {
    super('GameOverScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.black, 0.92);

    this.add.text(width / 2, height * 0.15, 'CASO RESOLVIDO', {
      ...FONT_STYLES.title,
      fontSize: '48px',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.24, 'Murphy Law — Investigações Privadas', {
      ...FONT_STYLES.subtitle,
      fontSize: '18px',
    }).setOrigin(0.5);

    const score = gameState.calculateGameCompletion();
    const scorePercent = Math.round(score * 100);

    this.add.text(width / 2, height * 0.36, `${scorePercent}%`, {
      fontFamily: FONTS.mono,
      fontSize: '56px',
      color: score >= 0.8 ? SCP.safe.hex : score >= 0.5 ? COLORS.amber : SCP.keter.hex,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.44, 'AVALIAÇÃO FINAL', {
      ...FONT_STYLES.label,
    }).setOrigin(0.5);

    const stats = [
      { label: 'Pistas encontradas', value: `${gameState.readHints.size}/18`, pct: gameState.readHints.size / 18, weight: '20%' },
      { label: 'Entrevistas completas', value: `${[...gameState.calledContacts].filter(c => c !== 'agente_scp' && !gameState.pdCutoffContacts.has(c)).length}/5`, pct: [...gameState.calledContacts].filter(c => c !== 'agente_scp' && !gameState.pdCutoffContacts.has(c)).length / 5, weight: '25%' },
      { label: 'Pistas de entrevista', value: `${gameState.readInterviewClues.size}/5`, pct: gameState.readInterviewClues.size / 5, weight: '15%' },
      { label: 'Dedução', value: gameState.deductionResult === 'correct' ? 'Correta' : '—', pct: gameState.deductionResult === 'correct' ? 1 : 0, weight: '25%' },
      { label: 'Conformidade TFT', value: this.getTFTLabel(), pct: this.getTFTScore(), weight: '15%' },
    ];

    let y = height * 0.52;
    const barW = 200;
    const barX = width / 2 + 40;

    for (const stat of stats) {
      const statLabel = this.add.text(width / 2 - 60, y, `${stat.label} (${stat.weight})`, {
        ...FONT_STYLES.label,
        color: COLORS.textSecondary,
      }).setOrigin(1, 0.5);

      const track = this.add.rectangle(barX + barW / 2, y, barW, 10, COLORS.bgCardNum, 1);
      track.setStrokeStyle(1, COLORS.textFaintNum, 0.5);

      const fillW = stat.pct * barW;
      const fillColor = stat.pct >= 0.8 ? SCP.safe.num : stat.pct >= 0.5 ? COLORS.amberStroke : SCP.keter.num;
      const fill = this.add.rectangle(barX + fillW / 2, y, fillW, 10, fillColor, 0.7);

      const valueText = this.add.text(barX + barW + 12, y, stat.value, {
        ...FONT_STYLES.label,
        color: COLORS.textPrimary,
      }).setOrigin(0, 0.5);

      y += 28;
    }

    const btnBg = this.add.rectangle(width / 2, height * 0.88, 240, 44, COLORS.bgCardNum, 0.9);
    btnBg.setStrokeStyle(2, COLORS.amberStroke, 0.5);
    btnBg.setInteractive({ useHandCursor: true });
    const btnText = this.add.text(width / 2, height * 0.88, 'NOVO CASO', {
      ...FONT_STYLES.btnSmall,
      fontSize: '16px',
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => btnBg.setFillStyle(COLORS.bgHoverNum, 0.9));
    btnBg.on('pointerout', () => btnBg.setFillStyle(COLORS.bgCardNum, 0.9));
    btnBg.on('pointerdown', () => {
      this.scene.stop('GameScene');
      this.scene.start('MainMenu');
    });

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private getTFTLabel(): string {
    const contacts = Object.keys(gameState.pdChoiceHistory);
    if (contacts.length === 0) return 'N/A';
    const score = gameState.calculateGameCompletion();
    return score >= 0.8 ? 'Alta' : score >= 0.5 ? 'Média' : 'Baixa';
  }

  private getTFTScore(): number {
    const contacts = Object.keys(gameState.pdChoiceHistory);
    if (contacts.length === 0) return 0;
    return gameState.calculateGameCompletion();
  }
}
