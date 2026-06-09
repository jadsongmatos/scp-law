import { Audio } from '../audio';

export default function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col h-screen w-full bg-noir-dark text-white font-mono uppercase relative items-center justify-center select-none">
      <div className="crt-overlay" />
      <div className="scanline" />
      <div className="rain-overlay" />
      <div className="vignette-overlay" />
      <h1 className="text-5xl text-noir-amber font-bold mb-2 tracking-widest text-center shadow-black drop-shadow-lg" style={{ fontFamily: 'Playfair Display, serif' }}>
        MURPHY LAW
      </h1>
      <p className="text-lg text-amber-700 mb-8 tracking-widest">INVESTIGAÇÕES PRIVADAS</p>
      <p className="text-zinc-500 text-xs mb-8 max-w-md text-center normal-case tracking-normal">
        A chuva não para. O schnapps acabou. Maria Kraft depositou Mk 500 na mesa — tudo que tinha.
        Helena, 9 anos, desaparecida há 3 semanas. A Volkspolizei arquiva. A cidade esquece.
        Murphy Law não esquece.
      </p>
      <button
        onClick={async () => { await Audio.init(); await Audio.startAmbient(); onStart(); }}
        className="relative z-50 border-2 border-noir-amber text-noir-amber px-8 py-4 hover:bg-noir-amber hover:text-black font-bold tracking-widest transition-colors"
      >
        ACEITAR O CASO
      </button>
    </div>
  );
}
