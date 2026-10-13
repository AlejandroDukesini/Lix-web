import { useEffect } from 'react';

/**
 * Marca la página como superficie de lectura (`<html data-reading>`). En el estilo
 * Maximalismo, las formas decorativas del fondo pasan por detrás del texto; mientras
 * se lee en la biblioteca se atenúan para que no interrumpan las líneas.
 */
export function useReadingSurface() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-reading', '');
    return () => root.removeAttribute('data-reading');
  }, []);
}
