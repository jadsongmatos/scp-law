import { Scene } from 'phaser';

export class BootScene extends Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('boot_bg', 'assets/images/noir/bg_escritorio.png');
  }

  create() {
    this.scene.start('Preloader');
  }
}
