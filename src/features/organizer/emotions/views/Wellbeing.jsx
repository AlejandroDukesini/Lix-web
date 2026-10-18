import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { useReducedMotion } from '../../../../hooks/useReducedMotion.js';
import { cx } from '../../../../utils/cx.js';
import { Section } from '../../shared/ui.jsx';
import { BREATHING, GROUNDING, REFLECTION_QUESTIONS, SELF_CARE } from '../content.js';

/** Respiración guiada: un círculo que crece y se encoge al ritmo de cada fase. */
function Breathing({ exercise }) {
  const reduced = useReducedMotion();
  const [running, setRunning] = useState(false);
  const initial = { phase: 0, left: exercise.phases[0].seconds, cycles: 0 };
  const [state, setState] = useState(initial);
  const { phase, left, cycles } = state;

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      setState((s) => {
        if (s.left > 1) return { ...s, left: s.left - 1 };
        const next = (s.phase + 1) % exercise.phases.length;
        return { phase: next, left: exercise.phases[next].seconds, cycles: next === 0 ? s.cycles + 1 : s.cycles };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, exercise]);

  const reset = () => {
    setRunning(false);
    setState(initial);
  };
  const current = exercise.phases[phase];
  return (
    <div className="org-panel org-breathing">
      <h3 className="org-row__title">{exercise.name}</h3>
      <p className="org-muted">{exercise.description}</p>
      <div
        className={cx('org-breathing__circle', running && !reduced && 'is-animated')}
        style={{ '--breath-scale': running ? current.scale : 0.7, '--breath-duration': `${current.seconds}s` }}
        aria-hidden="true"
      />
      <p className="org-breathing__phase" aria-live="polite">
        {running ? `${current.label} · ${left}` : 'Cuando quieras, pulsa Empezar'}
      </p>
      <p className="org-subtle">{cycles > 0 && `${cycles} ${cycles === 1 ? 'ciclo' : 'ciclos'}`}</p>
      <div className="org-toolbar">
        <Button icon={running ? Pause : Play} onClick={() => setRunning((r) => !r)}>
          {running ? 'Pausar' : 'Empezar'}
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={reset}>
          Reiniciar
        </Button>
      </div>
    </div>
  );
}

function Grounding() {
  const [step, setStep] = useState(0);
  const done = step >= GROUNDING.length;
  return (
    <div className="org-panel org-stack">
      <h3 className="org-row__title">5-4-3-2-1: volver al presente</h3>
      <p className="org-muted">Útil cuando la cabeza va muy rápido. Nombra en voz baja, sin prisa:</p>
      <ol className="org-grounding">
        {GROUNDING.map((g, i) => (
          <li key={g.count} className={cx(i < step && 'is-done', i === step && 'is-current')} aria-current={i === step ? 'step' : undefined}>
            <strong>{g.count}</strong> {g.text}
          </li>
        ))}
      </ol>
      <div className="org-toolbar">
        {done ? (
          <Button variant="secondary" icon={RotateCcw} onClick={() => setStep(0)}>
            Empezar de nuevo
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)}>{step === GROUNDING.length - 1 ? 'Terminar' : 'Siguiente'}</Button>
        )}
      </div>
      {done && <p className="org-banner org-banner--success">Hecho. Respira una vez más, despacio.</p>}
    </div>
  );
}

/** Ejercicios de calma y autocuidado. Todo funciona sin conexión. */
export function Wellbeing() {
  return (
    <div className="org-stack">
      <p className="org-banner">
        Estos ejercicios son herramientas sencillas de autocuidado, no un tratamiento. Si el malestar es muy intenso, dura mucho o sientes que estás en peligro, habla con
        alguien de confianza o con un profesional de la salud. En Colombia, la línea de emergencias es el <strong>123</strong>.
      </p>
      <Section title="Respirar">
        <div className="org-grid">
          {BREATHING.map((exercise) => (
            <Breathing key={exercise.id} exercise={exercise} />
          ))}
        </div>
      </Section>
      <Section title="Anclarse">
        <Grounding />
      </Section>
      <div className="org-two">
        <Section title="Pequeños cuidados">
          <ul className="org-care">
            {SELF_CARE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
        <Section title="Preguntas para reflexionar" description="Puedes responderlas al registrar una emoción, o solo pensarlas.">
          <ul className="org-care">
            {REFLECTION_QUESTIONS.map((q) => (
              <li key={q.id}>{q.text}</li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
