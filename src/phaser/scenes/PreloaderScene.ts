import { Scene } from 'phaser';
import { SCP, COLORS } from '../Theme';

export class PreloaderScene extends Scene {
  constructor() {
    super('Preloader');
  }

  init() {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    this.add.image(cx, cy, 'boot_bg').setAlpha(0.3);

    this.add.rectangle(cx, cy, 468, 32).setStrokeStyle(1, SCP.safe.num);

    const bar = this.add.rectangle(cx - 230, cy, 4, 28, SCP.safe.num);

    this.load.on('progress', (progress: number) => {
      bar.width = 4 + (460 * progress);
    });
  }

  preload() {
    this.load.setPath('assets/images/noir');

    this.load.image('bg_escritorio', 'bg_escritorio.png');
    this.load.image('bg_rua_chuva', 'bg_rua_chuva.png');
    this.load.image('bg_bar', 'bg_bar.png');
    this.load.image('bg_escola', 'bg_escola.png');
    this.load.image('bg_diretoria', 'bg_diretoria.png');
    this.load.image('bg_delegacia', 'bg_delegacia.png');
    this.load.image('bg_beco', 'bg_beco.png');
    this.load.image('bg_armazem', 'bg_armazem.png');

    this.load.image('map_escritorio', 'maps/map_escritorio.png');
    this.load.image('map_rua_chuva', 'maps/map_rua_chuva.png');
    this.load.image('map_bar', 'maps/map_bar.png');
    this.load.image('map_escola', 'maps/map_escola.png');
    this.load.image('map_diretoria', 'maps/map_diretoria.png');
    this.load.image('map_delegacia', 'maps/map_delegacia.png');
    this.load.image('map_beco', 'maps/map_beco.png');
    this.load.image('map_armazem', 'maps/map_armazem.png');

    this.load.image('item_cartao_visita', 'items/item_cartao_visita.png');
    this.load.image('item_fotografia', 'items/item_fotografia.png');
    this.load.image('item_isqueiro', 'items/item_isqueiro.png');
    this.load.image('item_fita_magnetica', 'items/item_fita_magnetica.png');
    this.load.image('item_cedula_500', 'items/item_cedula_500.png');
    this.load.image('item_gravador_cassete', 'items/item_gravador_cassete.png');

    this.load.audio('rainstorm', '/rainstorm.mp3');
  }

  create() {
    this.scene.start('MainMenu');
  }
}
