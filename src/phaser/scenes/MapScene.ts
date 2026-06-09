import { Scene } from 'phaser';
import { gameState } from '../GameState';
import { Audio } from '../../audio';
import { GAME_ROOMS } from '../../data';
import { COLORS, FONTS, FONT_STYLES, SCP } from '../Theme';

const ROOM_POSITIONS: Record<string, { x: number; y: number; connections: string[] }> = {
  escritorio: { x: 0.3, y: 0.35, connections: ['rua_chuva'] },
  rua_chuva: { x: 0.5, y: 0.35, connections: ['escritorio', 'bar', 'beco', 'escola'] },
  bar: { x: 0.7, y: 0.25, connections: ['rua_chuva'] },
  beco: { x: 0.35, y: 0.6, connections: ['rua_chuva', 'armazem'] },
  escola: { x: 0.7, y: 0.55, connections: ['rua_chuva', 'diretoria'] },
  diretoria: { x: 0.8, y: 0.7, connections: ['escola', 'delegacia'] },
  delegacia: { x: 0.55, y: 0.75, connections: ['diretoria'] },
  armazem: { x: 0.2, y: 0.75, connections: ['beco'] },
};

const MAP_TEX_MAP: Record<string, string> = {
  escritorio: 'map_escritorio',
  rua_chuva: 'map_rua_chuva',
  bar: 'map_bar',
  escola: 'map_escola',
  diretoria: 'map_diretoria',
  delegacia: 'map_delegacia',
  beco: 'map_beco',
  armazem: 'map_armazem',
};

export class MapScene extends Scene {
  constructor() {
    super('MapScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.black, 0.85);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.closeMap());

    const title = this.add.text(width / 2, 40, 'MAPA DA CIDADE', {
      ...FONT_STYLES.subtitle,
      color: COLORS.amber,
    }).setOrigin(0.5);

    const closeBtn = this.add.text(width - 40, 40, '✕', {
      fontFamily: FONTS.mono,
      fontSize: '20px',
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeMap());

    const mapArea = this.add.container(0, 0);

    const drawnConnections = new Set<string>();
    for (const [roomId, pos] of Object.entries(ROOM_POSITIONS)) {
      for (const connId of pos.connections) {
        const key = [roomId, connId].sort().join('-');
        if (drawnConnections.has(key)) continue;
        drawnConnections.add(key);

        const connPos = ROOM_POSITIONS[connId];
        if (!connPos) continue;

        const line = this.add.graphics();
        line.lineStyle(1, COLORS.textFaintNum, 0.5);
        line.beginPath();
        line.moveTo(pos.x * width, pos.y * height);
        line.lineTo(connPos.x * width, connPos.y * height);
        line.strokePath();
        mapArea.add(line);
      }
    }

    for (const [roomId, pos] of Object.entries(ROOM_POSITIONS)) {
      const room = GAME_ROOMS[roomId];
      if (!room) continue;

      const isVisited = gameState.visitedRooms.has(roomId);
      const isCurrent = gameState.currentRoomId === roomId;
      const cx = pos.x * width;
      const cy = pos.y * height;

      const nodeContainer = this.add.container(cx, cy);

      if (isVisited) {
        const texKey = MAP_TEX_MAP[roomId];
        if (texKey && this.textures.exists(texKey)) {
          const thumb = this.add.image(0, 0, texKey).setDisplaySize(80, 60);
          thumb.setAlpha(isCurrent ? 1 : 0.7);
          nodeContainer.add(thumb);
        }
      } else {
        const bg = this.add.rectangle(0, 0, 80, 60, COLORS.bgPanelNum, 0.8);
        bg.setStrokeStyle(1, COLORS.textFaintNum, 0.5);
        nodeContainer.add(bg);
        const q = this.add.text(0, 0, '?', {
          fontFamily: FONTS.mono,
          fontSize: '24px',
          color: '#444444',
        }).setOrigin(0.5);
        nodeContainer.add(q);
      }

      if (isCurrent) {
      const ring = this.add.circle(0, 0, 50, COLORS.amberStroke, 0);
      ring.setStrokeStyle(2, COLORS.amberStroke, 0.8);
        nodeContainer.add(ring);
      }

      const nameText = this.add.text(0, 42, isVisited ? room.name : '[?]', {
        ...FONT_STYLES.tiny,
        color: isCurrent ? COLORS.amber : isVisited ? COLORS.textSecondary : '#444444',
      }).setOrigin(0.5);
      nodeContainer.add(nameText);

      if (isVisited) {
        const hitArea = this.add.rectangle(0, 0, 80, 60, COLORS.black, 0);
        hitArea.setInteractive({ useHandCursor: true });
        hitArea.on('pointerover', () => {
          nameText.setColor(COLORS.amberBright);
        });
        hitArea.on('pointerout', () => {
          nameText.setColor(isCurrent ? COLORS.amber : COLORS.textSecondary);
        });
        hitArea.on('pointerdown', () => {
          if (roomId !== gameState.currentRoomId) {
            Audio.playDoor();
            gameState.travelTo(roomId);
            this.closeMap();
          }
        });
        nodeContainer.add(hitArea);
      }

      mapArea.add(nodeContainer);
    }

    this.cameras.main.fadeIn(200, 0, 0, 0);

    this.input.keyboard!.on('keydown-ESC', () => this.closeMap());
  }

  private closeMap() {
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      this.scene.stop('MapScene');
    });
  }
}
