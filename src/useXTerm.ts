import { useRef, useState, useEffect, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import type { ITerminalOptions } from '@xterm/xterm';

interface UseXTermOptions {
  options?: ITerminalOptions;
  addons?: any[];
}

export function useXTerm({ options, addons }: UseXTermOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [instance, setInstance] = useState<Terminal | null>(null);
  const addonsRef = useRef(addons);
  useEffect(() => {
    addonsRef.current = addons;
  }, [addons]);

  const termOptions = useMemo(() => options, [options]);

  useEffect(() => {
    const terminal = new Terminal(termOptions);
    addonsRef.current?.forEach((addon) => terminal.loadAddon(addon));
    if (ref.current) {
      terminal.open(ref.current);
    }
    setInstance(terminal);
    return () => {
      terminal.dispose();
      setInstance(null);
    };
  }, [termOptions]);

  return { ref, instance };
}
