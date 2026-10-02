/**
 * Capas lejanas del cielo: degradado base, amanecer cósmico del final,
 * nebulosas (gradientes difuminados con mezcla de color) y planetas lejanos.
 * Son decorativas; la línea de tiempo mueve sus contenedores (data-*).
 */
export function SkyLayers() {
  return (
    <>
      <div className="sky" aria-hidden="true">
        <span className="sky__base" />
        <span className="sky__dawn" data-dawn="" />
      </div>

      <div className="nebula" data-nebula="" aria-hidden="true">
        <span className="nebula__cloud nebula__cloud--violet" />
        <span className="nebula__cloud nebula__cloud--rose" />
        <span className="nebula__cloud nebula__cloud--indigo" />
        <span className="nebula__cloud nebula__cloud--gold" />
        <span className="nebula__veil" />
      </div>

      <div className="planets" data-planets="" aria-hidden="true">
        <svg className="planet planet--giant" viewBox="0 0 300 200">
          <defs>
            <linearGradient id="planet-bands" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0" className="planet-band-1" />
              <stop offset="0.3" className="planet-band-2" />
              <stop offset="0.45" className="planet-band-1" />
              <stop offset="0.62" className="planet-band-3" />
              <stop offset="0.8" className="planet-band-2" />
              <stop offset="1" className="planet-band-shadow" />
            </linearGradient>
            <radialGradient id="planet-shade" cx="30%" cy="30%" r="80%">
              <stop offset="0.5" stopOpacity="0" className="planet-shade" />
              <stop offset="1" stopOpacity="0.85" className="planet-shade" />
            </radialGradient>
          </defs>
          <path d="M40 112 A110 26 0 0 1 260 112" className="planet__ring planet__ring--back" />
          <circle cx="150" cy="100" r="58" fill="url(#planet-bands)" />
          <circle cx="150" cy="100" r="58" fill="url(#planet-shade)" />
          <path d="M260 112 A110 26 0 0 1 40 112" className="planet__ring" />
        </svg>
        <svg className="planet planet--moon" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="30" className="moon__body" />
          <circle cx="42" cy="42" r="6" className="moon__crater" />
          <circle cx="60" cy="58" r="4" className="moon__crater" />
          <circle cx="48" cy="64" r="3" className="moon__crater" />
          <path d="M50 20 A30 30 0 0 1 50 80 A22 30 0 0 0 50 20" className="moon__shadow" />
        </svg>
        <span className="planet planet--dot" />
      </div>
    </>
  );
}
