import { Scene } from 'phaser';
import { gameState } from '../GameState';
import { Audio } from '../../audio';
import { Interactable, ITEM_NAMES, PHONE_CONTACTS } from '../../data';
import { INTERACT } from '../../lib/itemUse';
import { COLORS, FONTS, FONT_STYLES, SCP, INTERACTABLE_CLASS, scpColor, scpNum, scpStroke } from '../Theme';

const BG_KEY_MAP: Record<string, string> = {
  escritorio: 'bg_escritorio',
  rua_chuva: 'bg_rua_chuva',
  bar: 'bg_bar',
  escola: 'bg_escola',
  diretoria: 'bg_diretoria',
  delegacia: 'bg_delegacia',
  beco: 'bg_beco',
  armazem: 'bg_armazem',
};

const ITEM_TEX_MAP: Record<string, string> = {
  cartao_visita: 'item_cartao_visita',
  fotografia: 'item_fotografia',
  isqueiro: 'item_isqueiro',
  fita_magnetica: 'item_fita_magnetica',
  cedula_500: 'item_cedula_500',
  gravador_cassete: 'item_gravador_cassete',
};

const TYPE_SYMBOLS: Record<string, string> = {
  inspect: '?',
  pickup: '+',
  travel: '>',
  terminal_read: '#',
  phone_call: '@',
};

export class GameScene extends Scene {
  private bgImage!: Phaser.GameObjects.Image;
  private interactableContainer!: Phaser.GameObjects.Container;
  private headerBar!: Phaser.GameObjects.Container;
  private sidebar!: Phaser.GameObjects.Container;
  private bottomTerminal!: Phaser.GameObjects.Container;
  private contextMenu!: Phaser.GameObjects.Container;
  private contextMenuBg!: Phaser.GameObjects.Rectangle;
  private selectedObj: Interactable | null = null;
  private terminalText!: Phaser.GameObjects.Text;
  private roomNameText!: Phaser.GameObjects.Text;
  private fogOverlay!: Phaser.GameObjects.Rectangle;
  private vignetteOverlay!: Phaser.GameObjects.Arc;
  private scanlineGraphics!: Phaser.GameObjects.Graphics;
  private scanlineY: number = 0;
  private _onRoomChanged!: () => void;
  private _onInventoryChanged!: () => void;
  private _onInteractablesChanged!: () => void;

  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    this.bgImage = this.add.image(0, 0, 'bg_escritorio').setOrigin(0);

    this.interactableContainer = this.add.container(0, 0);

    this.fogOverlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.bgDarkNum, 0.15);

    this.vignetteOverlay = this.add.circle(width / 2, height / 2, Math.max(width, height) * 0.6, COLORS.black, 0);

    this.scanlineGraphics = this.add.graphics();
    this.scanlineGraphics.setAlpha(0.03);

    this.createHeader(width);
    this.createSidebar(width, height);
    this.createBottomTerminal(width, height);
    this.createContextMenu();

    this.buildRoom();

    this._onRoomChanged = () => this.buildRoom();
    this._onInventoryChanged = () => this.refreshSidebar();
    this._onInteractablesChanged = () => this.buildRoom();

    gameState.on('roomChanged', this._onRoomChanged);
    gameState.on('inventoryChanged', this._onInventoryChanged);
    gameState.on('interactablesChanged', this._onInteractablesChanged);

    this.input.keyboard!.on('keydown-M', () => this.openMap());
    this.input.keyboard!.on('keydown-T', () => this.openTerminal());
    this.input.keyboard!.on('keydown-P', () => this.openPhoneAgenda());
    this.input.keyboard!.on('keydown-C', () => this.openCassette());
    this.input.keyboard!.on('keydown-ESC', () => this.closeContextMenu());
    this.input.keyboard!.on('keydown-D', () => this.openDeduction());

    this.events.on('shutdown', () => {
      gameState.off('roomChanged', this._onRoomChanged);
      gameState.off('inventoryChanged', this._onInventoryChanged);
      gameState.off('interactablesChanged', this._onInteractablesChanged);
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  update(_time: number, delta: number) {
    this.scanlineY += delta * 0.05;
    if (this.scanlineY > this.cameras.main.height) this.scanlineY = 0;

    this.scanlineGraphics.clear();
    const w = this.cameras.main.width;
    for (let y = 0; y < this.cameras.main.height; y += 4) {
      this.scanlineGraphics.fillStyle(0x000000, 0.06);
      this.scanlineGraphics.fillRect(0, y, w, 2);
    }
  }

  private createHeader(width: number) {
    this.headerBar = this.add.container(0, 0);

    const headerBg = this.add.rectangle(width / 2, 24, width, 48, COLORS.bgDarkNum, 0.95);
    headerBg.setStrokeStyle(1, COLORS.amberStroke, 0.3);
    this.headerBar.add(headerBg);

    const title = this.add.text(16, 24, 'MURPHY LAW', {
      ...FONT_STYLES.header,
    }).setOrigin(0, 0.5);
    this.headerBar.add(title);

    this.roomNameText = this.add.text(width / 2, 24, '', {
      ...FONT_STYLES.small,
    }).setOrigin(0.5);
    this.headerBar.add(this.roomNameText);

    const btnSettings = this.createHeaderButton(width - 48, 24, '⚙', () => {
      this.scene.launch('SettingsScene');
    });
    this.headerBar.add(btnSettings);

    const btnDeduction = this.createHeaderButton(width - 96, 24, '◈', () => {
      this.openDeduction();
    });
    this.headerBar.add(btnDeduction);

    this.headerBar.setDepth(100);
  }

  private createHeaderButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 36, 36, COLORS.bgCardNum, 0.8);
    bg.setStrokeStyle(1, COLORS.amberStroke, 0.3);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, {
      fontFamily: FONTS.mono,
      fontSize: '16px',
      color: COLORS.amber,
    }).setOrigin(0.5);
    btn.add([bg, text]);

    bg.on('pointerover', () => { bg.setFillStyle(COLORS.bgHoverNum, 0.9); });
    bg.on('pointerout', () => { bg.setFillStyle(COLORS.bgCardNum, 0.8); });
    bg.on('pointerdown', onClick);

    return btn;
  }

  private createSidebar(width: number, height: number) {
    this.sidebar = this.add.container(0, 0);
    this.sidebar.setDepth(90);
    this.refreshSidebar();
  }

  private refreshSidebar() {
    this.sidebar.removeAll(true);

    const { width, height } = this.cameras.main;
    const sideX = width - 200;
    const sideY = 60;

    const sideBg = this.add.rectangle(sideX + 100, height / 2, 200, height - 60, COLORS.bgDarkNum, 0.92);
    sideBg.setStrokeStyle(1, COLORS.amberStroke, 0.2);
    this.sidebar.add(sideBg);

    const toolsLabel = this.add.text(sideX + 100, sideY + 10, 'FERRAMENTAS', {
      ...FONT_STYLES.tiny,
    }).setOrigin(0.5);
    this.sidebar.add(toolsLabel);

    let itemY = sideY + 30;
    const tools = gameState.inventory.filter(id => gameState.isPermanentItem(id));
    for (const itemId of tools) {
      this.createSidebarItem(sideX + 10, itemY, itemId);
      itemY += 50;
    }

    const evidence = gameState.inventory.filter(id => !gameState.isPermanentItem(id));
    if (evidence.length > 0) {
      const evLabel = this.add.text(sideX + 100, itemY + 10, 'EVIDÊNCIAS', {
        ...FONT_STYLES.tiny,
      }).setOrigin(0.5);
      this.sidebar.add(evLabel);
      itemY += 30;
      for (const itemId of evidence) {
        this.createSidebarItem(sideX + 10, itemY, itemId);
        itemY += 50;
      }
    }

    const btnY = height - 100;
    const btnMap = this.createSidebarButton(sideX + 100, btnY, 'MAPA', 'M', () => this.openMap());
    const btnAgenda = this.createSidebarButton(sideX + 100, btnY + 36, 'AGENDA', 'P', () => this.openPhoneAgenda());
    const btnCassette = this.createSidebarButton(sideX + 100, btnY + 72, 'FITA CASSETE', 'C', () => this.openCassette());
    this.sidebar.add([btnMap, btnAgenda, btnCassette]);
  }

  private createSidebarItem(x: number, y: number, itemId: string) {
    const texKey = ITEM_TEX_MAP[itemId];
    if (texKey && this.textures.exists(texKey)) {
      const img = this.add.image(x + 20, y + 20, texKey).setDisplaySize(32, 32);
      this.sidebar.add(img);
    }
    const name = ITEM_NAMES[itemId] || itemId;
    const label = this.add.text(x + 56, y + 20, name, {
      ...FONT_STYLES.label,
      color: COLORS.textPrimary,
      wordWrap: { width: 130 },
    }).setOrigin(0, 0.5);
    this.sidebar.add(label);
  }

  private createSidebarButton(x: number, y: number, label: string, shortcut: string, onClick: () => void): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 180, 28, COLORS.bgCardNum, 0.9);
    bg.setStrokeStyle(1, COLORS.amberStroke, 0.3);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, `${label} [${shortcut}]`, {
      ...FONT_STYLES.btnSmall,
    }).setOrigin(0.5);
    btn.add([bg, text]);
    bg.on('pointerover', () => { bg.setFillStyle(COLORS.bgHoverNum, 0.9); });
    bg.on('pointerout', () => { bg.setFillStyle(COLORS.bgCardNum, 0.9); });
    bg.on('pointerdown', onClick);
    return btn;
  }

  private createBottomTerminal(width: number, height: number) {
    this.bottomTerminal = this.add.container(0, height - 120);
    this.bottomTerminal.setDepth(80);

    const termBg = this.add.rectangle(width / 2 - 100, 60, width - 200, 120, COLORS.bgDarkNum, 0.95);
    termBg.setStrokeStyle(1, COLORS.greenStroke, 0.2);
    this.bottomTerminal.add(termBg);

    const termLabel = this.add.text(16, 8, 'DIÁRIO DE MURPHY', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: COLORS.green,
    });
    this.bottomTerminal.add(termLabel);

    this.terminalText = this.add.text(16, 24, '', {
      fontFamily: FONTS.mono,
      fontSize: '11px',
      color: COLORS.green,
      wordWrap: { width: width - 240 },
      lineSpacing: 3,
    });
    this.bottomTerminal.add(this.terminalText);

    gameState.on('terminalLog', () => {
      const logs = gameState.terminalLogs;
      const last20 = logs.slice(-20);
      this.terminalText.setText(last20.join('\n'));
    });
  }

  private createContextMenu() {
    this.contextMenu = this.add.container(0, 0);
    this.contextMenu.setDepth(200);
    this.contextMenu.setVisible(false);
  }

  private showContextMenu(x: number, y: number, obj: Interactable) {
    this.contextMenu.removeAll(true);
    this.selectedObj = obj;

    const { width, height } = this.cameras.main;
    const menuW = 220;
    const itemH = 36;
    const headerH = 40;
    const itemCount = gameState.inventory.length + 1;
    const menuH = headerH + itemCount * itemH;

    let mx = x + 10;
    let my = y;
    if (mx + menuW > width) mx = x - menuW - 10;
    if (my + menuH > height) my = height - menuH - 10;
    if (my < 0) my = 0;

    const bg = this.add.rectangle(mx + menuW / 2, my + menuH / 2, menuW, menuH, COLORS.bgPanelNum, 0.97);
    bg.setStrokeStyle(2, COLORS.amberStroke, 0.6);
    this.contextMenu.add(bg);

    const header = this.add.text(mx + 10, my + 12, obj.label, {
      ...FONT_STYLES.small,
      color: COLORS.amber,
      wordWrap: { width: menuW - 20 },
    });
    this.contextMenu.add(header);

    let btnY = my + headerH;

    const interBg = this.add.rectangle(mx + menuW / 2, btnY + itemH / 2, menuW, itemH, COLORS.bgCardNum, 0.9);
    interBg.setInteractive({ useHandCursor: true });
    const interText = this.add.text(mx + 16, btnY + itemH / 2, '▸ Interagir', {
      ...FONT_STYLES.monoGreen,
    }).setOrigin(0, 0.5);
    this.contextMenu.add([interBg, interText]);
    interBg.on('pointerover', () => interBg.setFillStyle(COLORS.bgGreenHoverNum, 0.9));
    interBg.on('pointerout', () => interBg.setFillStyle(COLORS.bgCardNum, 0.9));
    interBg.on('pointerdown', () => {
      this.handleMenuSelect(obj, INTERACT);
      this.closeContextMenu();
    });
    btnY += itemH;

    for (const itemId of gameState.inventory) {
      const name = ITEM_NAMES[itemId] || itemId;
      const itemBg = this.add.rectangle(mx + menuW / 2, btnY + itemH / 2, menuW, itemH, COLORS.bgItemNum, 0.9);
      itemBg.setInteractive({ useHandCursor: true });
      const texKey = ITEM_TEX_MAP[itemId];
      let itemEntry: Phaser.GameObjects.GameObject[];
      if (texKey && this.textures.exists(texKey)) {
        const icon = this.add.image(mx + 20, btnY + itemH / 2, texKey).setDisplaySize(22, 22);
        const txt = this.add.text(mx + 42, btnY + itemH / 2, `Usar ${name}`, {
          ...FONT_STYLES.monoAmber,
        }).setOrigin(0, 0.5);
        itemEntry = [itemBg, icon, txt];
      } else {
        const txt = this.add.text(mx + 16, btnY + itemH / 2, `Usar ${name}`, {
          ...FONT_STYLES.monoAmber,
        }).setOrigin(0, 0.5);
        itemEntry = [itemBg, txt];
      }
      this.contextMenu.add(itemEntry);
      itemBg.on('pointerover', () => itemBg.setFillStyle(COLORS.bgHoverNum, 0.9));
      itemBg.on('pointerout', () => itemBg.setFillStyle(COLORS.bgItemNum, 0.9));
      itemBg.on('pointerdown', () => {
        this.handleMenuSelect(obj, itemId);
        this.closeContextMenu();
      });
      btnY += itemH;
    }

    this.contextMenu.setVisible(true);

    this.time.delayedCall(50, () => {
      this.input.on('pointerdown', this.onGlobalPointerDown, this);
    });
  }

  private onGlobalPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.contextMenu.visible) return;
    const menuBounds = this.contextMenu.getBounds();
    if (!menuBounds.contains(pointer.x, pointer.y)) {
      this.closeContextMenu();
    }
  }

  private closeContextMenu() {
    this.contextMenu.setVisible(false);
    this.contextMenu.removeAll(true);
    this.selectedObj = null;
    this.input.off('pointerdown', this.onGlobalPointerDown, this);
  }

  private handleMenuSelect(obj: Interactable, selection: string) {
    if (selection === INTERACT) {
      const outcome = gameState.handleInteract(obj);
      if (outcome === 'denied') {
        Audio.playDenied();
      const msg = obj.failedMessage || 'Acesso negado.';
      gameState.addTerminalLog(`[ACESSO NEGADO] ${msg}`, SCP.keter.hex);
    } else {
      this.processAction(obj);
    }
  } else {
    const outcome = gameState.handleItemUse(obj, selection);
    if (outcome === 'unlock') {
      const msg = obj.successMessage || 'Destrancou!';
      gameState.addTerminalLog(`[DESTRANCADO] ${msg}`, SCP.safe.hex);
        Audio.playPickup();
        this.processAction(obj);
      } else if (outcome === 'denied') {
        Audio.playDenied();
      const msg = obj.failedMessage || 'Não funciona.';
      gameState.addTerminalLog(`[FALHOU] ${msg}`, SCP.keter.hex);
    } else if (outcome === 'not-applicable') {
      gameState.addTerminalLog('Não serve aqui.', COLORS.textSecondary);
      } else {
        this.processAction(obj);
      }
    }
  }

  private processAction(obj: Interactable) {
    switch (obj.type) {
    case 'inspect': {
      const msg = obj.description || obj.label;
      gameState.addTerminalLog(msg, COLORS.textPrimary);
        Audio.playTypewriter();
        break;
      }
    case 'pickup': {
      const name = ITEM_NAMES[obj.pickupItem!] || obj.pickupItem!;
      gameState.addTerminalLog(`Coletou: ${name}`, SCP.safe.hex);
        Audio.playPickup();
        break;
      }
    case 'travel': {
      const targetName = gameState.localRooms[obj.targetRoom!]?.name || obj.targetRoom!;
      gameState.addTerminalLog(`Entrou: ${targetName}`, SCP.safe.hex);
        Audio.playDoor();
        break;
      }
      case 'terminal_read': {
        if (obj.documentData) {
          Audio.speak(obj.id);
          Audio.playTerminal();
          this.scene.launch('TerminalScene', { documentData: obj.documentData, objId: obj.id });
        }
        break;
      }
      case 'phone_call': {
        if (obj.phoneCallId) {
          if (!gameState.canCallPhone() && obj.phoneCallId !== 'seu_jonas') {
                    gameState.addTerminalLog('[TELEFONE] Só funciona do escritório.', SCP.keter.hex);
          } else {
            this.scene.launch('PhoneScene', { contactId: obj.phoneCallId });
          }
        }
        break;
      }
    }
  }

  private buildRoom() {
    const room = gameState.currentRoom;
    if (!room) return;

    const { width, height } = this.cameras.main;

    const texKey = BG_KEY_MAP[gameState.currentRoomId];
    if (texKey && this.textures.exists(texKey)) {
      this.bgImage.setTexture(texKey);
    }

    const scaleX = width / this.bgImage.width;
    const scaleY = height / this.bgImage.height;
    const scale = Math.max(scaleX, scaleY);
    this.bgImage.setScale(scale).setOrigin(0);
    this.bgImage.setPosition(
      (width - this.bgImage.width * scale) / 2,
      (height - this.bgImage.height * scale) / 2
    );

    this.roomNameText.setText(room.name);

    this.interactableContainer.removeAll(true);

    const visibleObjs = gameState.getVisibleInteractables();
    for (const obj of visibleObjs) {
      this.createInteractable(obj, width, height);
    }
  }

  private createInteractable(obj: Interactable, viewW: number, viewH: number) {
    const x = (obj.x / 100) * viewW;
    const y = (obj.y / 100) * viewH;
    const w = obj.width ? (obj.width / 100) * viewW : 40;
    const h = obj.height ? (obj.height / 100) * viewH : 40;

    const container = this.add.container(x, y);

    const cls = INTERACTABLE_CLASS[obj.type] || 'safe';
    const color = scpNum(cls);
    const symbol = TYPE_SYMBOLS[obj.type] || '?';

    if (obj.width && obj.height) {
      const zone = this.add.rectangle(0, 0, w, h, color, 0.0);
      zone.setStrokeStyle(1, color, 0.15);
      zone.setInteractive({ useHandCursor: true });

      const label = this.add.text(0, 0, obj.label, {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: COLORS.textDim,
      }).setOrigin(0.5);

      container.add([zone, label]);

      zone.on('pointerover', () => {
        zone.setFillStyle(color, 0.08);
        zone.setStrokeStyle(1, color, 0.4);
        label.setColor(COLORS.textSecondary);
        Audio.playHover();
      });
      zone.on('pointerout', () => {
        zone.setFillStyle(color, 0.0);
        zone.setStrokeStyle(1, color, 0.15);
        label.setColor(COLORS.textDim);
      });
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.showContextMenu(pointer.x, pointer.y, obj);
      });
    } else {
      const pickupItem = obj.pickupItem;
      const texKey = pickupItem ? ITEM_TEX_MAP[pickupItem] : null;

      if (texKey && this.textures.exists(texKey) && !obj.hideIcon) {
        const img = this.add.image(0, 0, texKey).setDisplaySize(36, 36);
        img.setInteractive({ useHandCursor: true });
        img.setAlpha(0.3);

      const label = this.add.text(0, 24, obj.label, {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: COLORS.textDim,
      }).setOrigin(0.5);

      container.add([img, label]);

      img.on('pointerover', () => {
        img.setAlpha(0.8);
        label.setColor(COLORS.amber);
        Audio.playHover();
      });
      img.on('pointerout', () => {
        img.setAlpha(0.3);
        label.setColor(COLORS.textDim);
        });
        img.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.showContextMenu(pointer.x, pointer.y, obj);
        });
      } else {
        const iconBg = this.add.circle(0, 0, 18, color, 0.1);
        iconBg.setStrokeStyle(1, color, 0.3);
        iconBg.setInteractive({ useHandCursor: true });

      const iconText = this.add.text(0, 0, symbol, {
        fontFamily: FONTS.mono,
        fontSize: '16px',
        color: '#333333',
      }).setOrigin(0.5);

      const label = this.add.text(0, 26, obj.label, {
        fontFamily: FONTS.mono,
        fontSize: '9px',
        color: COLORS.textDim,
      }).setOrigin(0.5);

      container.add([iconBg, iconText, label]);

      iconBg.on('pointerover', () => {
        iconBg.setFillStyle(color, 0.25);
        iconBg.setStrokeStyle(1, color, 0.7);
        iconText.setColor(COLORS.amber);
        label.setColor(COLORS.amber);
        Audio.playHover();
      });
      iconBg.on('pointerout', () => {
        iconBg.setFillStyle(color, 0.1);
        iconBg.setStrokeStyle(1, color, 0.3);
        iconText.setColor('#333333');
        label.setColor(COLORS.textDim);
        });
        iconBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.showContextMenu(pointer.x, pointer.y, obj);
        });
      }
    }

    this.interactableContainer.add(container);
  }

  private openMap() {
    this.scene.launch('MapScene');
  }

  private openTerminal() {
    this.scene.launch('TerminalScene', { documentData: null });
  }

  private openPhoneAgenda() {
    this.scene.launch('PhoneScene', { contactId: null });
  }

  private openCassette() {
    this.scene.launch('CassetteScene');
  }

  private openDeduction() {
    this.scene.launch('DeductionScene');
  }
}
