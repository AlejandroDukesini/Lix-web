import { Link } from 'react-router';
import { HeartHandshake } from 'lucide-react';
import { Section } from '../../shared/ui.jsx';
import { dayOf } from '../emotionStats.js';
import { LogForm } from '../LogForm.jsx';
import { useEmotions } from '../useEmotions.js';
import { LogRow } from './LogRow.jsx';

/** Registrar ahora y ver lo registrado hoy. */
export function Today() {
  const data = useEmotions();
  const today = data.logs.filter((l) => dayOf(l) === data.today);
  const recent = data.logs.filter((l) => dayOf(l) !== data.today).slice(0, 5);
  return (
    <div className="org-two">
      <div className="org-stack">
        <LogForm inline />
        <p className="org-banner">
          <HeartHandshake aria-hidden="true" />
          <span>
            Este diario sirve para reconocer lo que sientes y verlo con el tiempo. No diagnostica ni sustituye la ayuda de un profesional. Si sientes que estás en
            peligro o que no puedes más, busca apoyo: en Colombia, la línea de emergencias es el <strong>123</strong>. <Link to="/emociones/bienestar">Ejercicios de calma</Link>
          </span>
        </p>
      </div>
      <div className="org-stack">
        <Section title="Hoy">
          {today.length ? (
            <ul className="org-list">
              {today.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </ul>
          ) : (
            <p className="org-muted">Todavía no hay registros hoy. Puedes registrar tantas veces como quieras.</p>
          )}
        </Section>
        {recent.length > 0 && (
          <Section title="Antes" action={<Link to="/emociones/historial">Ver todo el historial</Link>}>
            <ul className="org-list">
              {recent.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}
