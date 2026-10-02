import { useEffect, useState } from 'react';

/** Fecha actual que se refresca cada `intervalMs`, alineada al inicio de cada intervalo. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    return () => clearTimeout(timer);
  }, [intervalMs]);

  return now;
}
