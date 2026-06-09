import { Scene } from 'phaser';
import { gameState } from '../GameState';
import { Audio } from '../../audio';
import { PHONE_CONTACTS } from '../../data';
import { COLORS, FONTS, FONT_STYLES, SCP } from '../Theme';

const AXELROD_CUTOFF: Record<string, (playerDefections: number) => boolean> = {
  Grudger: () => true,
  TitForTat: () => true,
  SoftGrudger: (d) => d >= 3,
  WinStayLoseShift: () => false,
  Forgiver: () => false,
};

const PHONE_ACCENT = SCP.thaumiel;

export class PhoneScene extends Scene {
  private contactId: string | null = null;
  private isAgendaMode: boolean = true;
  private activeNodeId: string = '';
  private visitedNodes: string[] = [];
  private linesShown: number = 0;
  private dialogueContainer!: Phaser.GameObjects.Container;
  private panelW: number = 0;
  private panelH: number = 0;
  private panelX: number = 0;
  private panelY: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private maxScroll: number = 0;
  private scrollY: number = 0;

  constructor() {
    super('PhoneScene');
  }

  init(data: { contactId?: string | null }) {
    if (data.contactId) {
      this.contactId = data.contactId;
      this.isAgendaMode = false;
      const contact = PHONE_CONTACTS[data.contactId];
      this.activeNodeId = contact ? Object.keys(contact.dialogue)[0] : '';
      this.visitedNodes = [];
      this.linesShown = 0;
      gameState.discoveredContacts.add(data.contactId);
      gameState.calledContacts.add(data.contactId);
    } else {
      this.isAgendaMode = true;
      this.contactId = null;
    }
    this.scrollY = 0;
  }

  create() {
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.black, 0.85);
    overlay.setInteractive();

    this.panelW = width * 0.6;
    this.panelH = height * 0.8;
    this.panelX = (width - this.panelW) / 2;
    this.panelY = (height - this.panelH) / 2;

    const panel = this.add.rectangle(
      this.panelX + this.panelW / 2,
      this.panelY + this.panelH / 2,
      this.panelW, this.panelH, COLORS.bgDarkNum, 0.98
    );
    panel.setStrokeStyle(2, PHONE_ACCENT.num, 0.4);

    const headerBg = this.add.rectangle(
      this.panelX + this.panelW / 2,
      this.panelY + 20,
      this.panelW, 40, 0x1a0a00, 0.8
    );
    headerBg.setStrokeStyle(1, PHONE_ACCENT.num, 0.2);

    const headerText = this.add.text(this.panelX + 20, this.panelY + 20, 'AGENDA TELEFÔNICA', {
      fontFamily: FONTS.mono,
      fontSize: '14px',
      color: PHONE_ACCENT.hex,
    }).setOrigin(0, 0.5);

    const closeBtn = this.add.text(this.panelX + this.panelW - 20, this.panelY + 20, '✕', {
      fontFamily: FONTS.mono,
      fontSize: '18px',
      color: PHONE_ACCENT.hex,
    }).setInteractive({ useHandCursor: true });
    closeBtn.setOrigin(0.5);
    closeBtn.on('pointerdown', () => this.close());

    this.dialogueContainer = this.add.container(0, 0);
    this.contentContainer = this.add.container(this.panelX + 20, this.panelY + 50);

    if (this.isAgendaMode) {
      this.renderAgenda();
    } else {
      this.renderDialogue();
    }

    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objs: any[], _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScroll);
      this.contentContainer.setY(this.panelY + 50 - this.scrollY);
    });

    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  private renderAgenda() {
    this.contentContainer.removeAll(true);
    let y = 0;

    const contacts = Object.entries(PHONE_CONTACTS);
    for (const [id, contact] of contacts) {
      if (id === 'agente_scp') continue;
      if (!gameState.discoveredContacts.has(id)) continue;

      const isCutoff = gameState.pdCutoffContacts.has(id);
      const hasCalled = gameState.calledContacts.has(id);
      const isLetter = id === 'seu_jonas';

      const row = this.add.container(0, y);

      const bg = this.add.rectangle(this.panelW / 2 - 20, 22, this.panelW - 40, 44, COLORS.bgCardNum, 0.9);
      bg.setStrokeStyle(1, PHONE_ACCENT.num, 0.2);

      if (!isCutoff) {
        bg.setInteractive({ useHandCursor: true });
      }

      const nameText = this.add.text(12, 10, contact.name, {
        fontFamily: FONTS.mono,
        fontSize: '12px',
        color: isCutoff ? '#553333' : PHONE_ACCENT.hex,
      });

      const numberText = this.add.text(12, 28, `${isLetter ? '✉ Carta' : '☎ ' + contact.number}`, {
        ...FONT_STYLES.tiny,
        color: isCutoff ? COLORS.textFaint : COLORS.textSecondary,
      });

      const statusText = this.add.text(this.panelW - 60, 16, isCutoff ? 'BLOQUEADO' : hasCalled ? '✓' : 'NOVO', {
        ...FONT_STYLES.tiny,
        color: isCutoff ? SCP.keter.hex : hasCalled ? SCP.safe.hex : COLORS.amber,
      });

      row.add([bg, nameText, numberText, statusText]);

      if (!isCutoff) {
      const canCall = isLetter || gameState.canCallPhone();
      bg.on('pointerover', () => {
        if (canCall) bg.setFillStyle(COLORS.bgHoverNum, 0.9);
      });
      bg.on('pointerout', () => bg.setFillStyle(COLORS.bgCardNum, 0.9));
      bg.on('pointerdown', () => {
        if (!canCall) {
          gameState.addTerminalLog('[TELEFONE] Só funciona do escritório.', SCP.keter.hex);
            return;
          }
          this.contactId = id;
          this.isAgendaMode = false;
          this.activeNodeId = Object.keys(contact.dialogue)[0];
          this.visitedNodes = [];
          this.linesShown = 0;
          gameState.calledContacts.add(id);
          if (!gameState.pdChoiceHistory[id]) {
            gameState.pdChoiceHistory[id] = [];
          }
          this.renderDialogue();
        });
      }

      this.contentContainer.add(row);
      y += 52;
    }

    if (y === 0) {
    const empty = this.add.text(0, 20, 'Nenhum contato descoberto ainda.', {
      ...FONT_STYLES.mono,
      color: COLORS.textDim,
    });
      this.contentContainer.add(empty);
    }

    this.maxScroll = Math.max(0, y - this.panelH + 70);
  }

  private renderDialogue() {
    this.contentContainer.removeAll(true);
    this.scrollY = 0;
    this.contentContainer.setY(this.panelY + 50);

    if (!this.contactId) return;
    const contact = PHONE_CONTACTS[this.contactId];
    if (!contact) return;

    let y = 0;

  const contactTitle = this.add.text(0, y, `☎ ${contact.name}`, {
    fontFamily: FONTS.mono,
    fontSize: '14px',
    color: PHONE_ACCENT.hex,
  });
    y += 28;
    this.contentContainer.add(contactTitle);

    for (const nodeId of this.visitedNodes) {
      const node = contact.dialogue[nodeId];
      if (!node) continue;
      y = this.renderNode(node, y);
    }

    const currentNode = contact.dialogue[this.activeNodeId];
    if (currentNode && !this.visitedNodes.includes(this.activeNodeId)) {
      y = this.renderNode(currentNode, y);
      this.visitedNodes.push(this.activeNodeId);

      if (currentNode.choices.length > 0) {
        y = this.renderChoices(currentNode.choices, y);
      } else {
        this.handleTerminalNode(currentNode);
      }
    }

    this.maxScroll = Math.max(0, y - this.panelH + 70);
  }

  private renderNode(
    node: { speaker: string; lines: string[]; choices: { text: string; goto: string; pdAction?: string }[] },
    startY: number
  ): number {
    let y = startY;

    const speaker = this.add.text(0, y, `${node.speaker}:`, {
      ...FONT_STYLES.monoAmber,
    });
    this.contentContainer.add(speaker);
    y += 18;

    const linesToShow = node.lines.slice(0, this.linesShown || node.lines.length);
    for (const line of linesToShow) {
      const lineText = this.add.text(8, y, line, {
        ...FONT_STYLES.mono,
        wordWrap: { width: this.panelW - 60 },
        lineSpacing: 3,
      });
      this.contentContainer.add(lineText);
      y += lineText.height + 4;
    }

    y += 8;
    return y;
  }

  private renderChoices(
    choices: { text: string; goto: string; pdAction?: string }[],
    startY: number
  ): number {
    let y = startY;

    const label = this.add.text(0, y, '— Escolha:', {
      ...FONT_STYLES.label,
    });
    this.contentContainer.add(label);
    y += 20;

    const pdLabels: Record<string, string> = { C: 'Cooperar', D: 'Trair', E: 'Encerrar' };
    const pdColors: Record<string, string> = { C: SCP.safe.hex, D: SCP.keter.hex, E: COLORS.textSecondary };

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      const pdTag = choice.pdAction ? ` [${pdLabels[choice.pdAction] || choice.pdAction}]` : '';
      const color = choice.pdAction ? pdColors[choice.pdAction] || '#cccccc' : '#cccccc';

      const btnContainer = this.add.container(8, y);

      const btnBg = this.add.rectangle((this.panelW - 76) / 2, 16, this.panelW - 76, 32, COLORS.bgCardNum, 0.9);
      btnBg.setStrokeStyle(1, COLORS.amberStroke, 0.2);
      btnBg.setInteractive({ useHandCursor: true });

      const btnText = this.add.text(12, 16, `${i + 1}. ${choice.text}${pdTag}`, {
        ...FONT_STYLES.mono,
        color,
        wordWrap: { width: this.panelW - 100 },
      }).setOrigin(0, 0.5);

      btnContainer.add([btnBg, btnText]);

      btnBg.on('pointerover', () => btnBg.setFillStyle(COLORS.bgHoverNum, 0.9));
      btnBg.on('pointerout', () => btnBg.setFillStyle(COLORS.bgCardNum, 0.9));
      btnBg.on('pointerdown', () => {
        this.selectChoice(choice);
      });

      this.contentContainer.add(btnContainer);
      y += 38;
    }

    return y;
  }

  private selectChoice(choice: { text: string; goto: string; pdAction?: string }) {
    if (!this.contactId) return;

    if (choice.pdAction && choice.pdAction !== 'E') {
      if (!gameState.pdChoiceHistory[this.contactId]) {
        gameState.pdChoiceHistory[this.contactId] = [];
      }
      gameState.pdChoiceHistory[this.contactId].push(choice.pdAction);
    }

    if (choice.pdAction === 'C') {
      gameState.addTerminalLog(`[${PHONE_CONTACTS[this.contactId].name}] Cooperou.`, SCP.safe.hex);
    } else if (choice.pdAction === 'D') {
      gameState.addTerminalLog(`[${PHONE_CONTACTS[this.contactId].name}] Traiu.`, SCP.keter.hex);
    } else if (choice.pdAction === 'E') {
      gameState.addTerminalLog(`[${PHONE_CONTACTS[this.contactId].name}] Encerrou.`, COLORS.textSecondary);
    }

    this.activeNodeId = choice.goto;
    this.linesShown = 0;
    this.renderDialogue();
  }

  private handleTerminalNode(node: { speaker: string; lines: string[]; choices: { text: string; goto: string; pdAction?: string }[] }) {
    if (!this.contactId) return;
    const contact = PHONE_CONTACTS[this.contactId];
    if (!contact) return;

    const lastChoice = gameState.pdChoiceHistory[this.contactId]?.at(-1);
    if (lastChoice === 'D') {
      const strategy = contact.axelrodStrategy;
      const cutoffFn = AXELROD_CUTOFF[strategy];
      if (cutoffFn) {
        const playerDefections = gameState.pdChoiceHistory[this.contactId]?.filter(c => c === 'D').length || 0;
        if (cutoffFn(playerDefections)) {
          gameState.pdCutoffContacts.add(this.contactId);
          gameState.addTerminalLog(`[${contact.name}] Contato bloqueado permanentemente.`, SCP.keter.hex);
        }
      }
    }

    this.saveRecording();
  }

  private saveRecording() {
    if (!this.contactId) return;
    const contact = PHONE_CONTACTS[this.contactId];
    if (!contact) return;

    const allLines: { speaker: string; lines: string[] }[] = [];
    for (const nodeId of this.visitedNodes) {
      const node = contact.dialogue[nodeId];
      if (node) {
        allLines.push({ speaker: node.speaker, lines: node.lines });
      }
    }
    gameState.phoneRecordings[this.contactId] = allLines;

    if (contact.murphyCommentary) {
      const commentary: string[] = [];
      for (const nodeId of this.visitedNodes) {
        if (contact.murphyCommentary[nodeId]) {
          commentary.push(...contact.murphyCommentary[nodeId]);
        }
      }
      if (commentary.length > 0) {
        gameState.murphyCommentaryMap[this.contactId] = commentary;
      }
    }

    gameState.emit('contactsChanged');
  }

  private close() {
    if (!this.isAgendaMode && this.contactId) {
      this.saveRecording();
    }
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      this.scene.stop('PhoneScene');
    });
  }
}
