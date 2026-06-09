import { useState } from 'react';
import { GameProvider, useGameState } from './GameState';
import TitleScreen from './TitleScreen';
import GameScreen from './GameScreen';

function AppInner() {
  const [hasStarted, setHasStarted] = useState(false);

  if (!hasStarted) {
    return <TitleScreen onStart={() => setHasStarted(true)} />;
  }

  return <GameScreen />;
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
