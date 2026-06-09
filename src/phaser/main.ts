import { AUTO, Game, Scale } from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloaderScene } from './scenes/PreloaderScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { MapScene } from './scenes/MapScene';
import { TerminalScene } from './scenes/TerminalScene';
import { PhoneScene } from './scenes/PhoneScene';
import { DeductionScene } from './scenes/DeductionScene';
import { CassetteScene } from './scenes/CassetteScene';
import { SettingsScene } from './scenes/SettingsScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1280,
  height: 800,
  parent: 'game-container',
  backgroundColor: '#0a0a0a',
  scale: {
    mode: Scale.FIT,
    autoCenter: Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloaderScene,
    MainMenuScene,
    GameScene,
    MapScene,
    TerminalScene,
    PhoneScene,
    DeductionScene,
    CassetteScene,
    SettingsScene,
    GameOverScene,
  ],
  dom: {
    createContainer: false,
  },
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};

export default StartGame;
