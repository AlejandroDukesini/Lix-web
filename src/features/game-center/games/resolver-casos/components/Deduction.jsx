import { useState } from 'react';
import { Gavel, Lightbulb } from 'lucide-react';
import { Button } from '../../../../../components/common/Button.jsx';
import { cx } from '../../../../../utils/cx.js';
import { missingRequirements, readyToAccuse } from '../engine/caseEngine.js';
import { Avatar, evidenceOptions } from './Notebook.jsx';

/**
 * Conclusión: elegir culpable y la prueba que desmiente su declaración.
 * Solo se puede presentar con lo imprescindible ya encontrado.
 */
export function Deduction({ caseData, state, feedback, hints, onAccuse, onHint }) {
  const [culprit, setCulprit] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const ready = readyToAccuse(state, caseData);
  const missing = missingRequirements(state, caseData).length;
  const options = evidenceOptions(caseData, state);

  return (
    <div className="cs-deduction">
      <p className="cs-deduction__question">{caseData.question}</p>

      {!ready && (
        <p className="cs-deduction__locked" role="status">
          Aún te {missing === 1 ? 'falta una pista importante' : `faltan ${missing} pistas importantes`}. Examina todo el escenario e
          interroga a todas las personas antes de acusar.
        </p>
      )}

      <fieldset className="cs-choice" disabled={!ready}>
        <legend>¿Quién fue?</legend>
        <div className="cs-choice__options">
          {caseData.people.map((person) => (
            <label key={person.id} className={cx('cs-option', culprit === person.id && 'is-checked')}>
              <input type="radio" name="culprit" className="sr-only" checked={culprit === person.id} onChange={() => setCulprit(person.id)} />
              <Avatar person={person} />
              <span>{person.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="cs-choice" disabled={!ready}>
        <legend>¿Qué prueba desmiente su declaración?</legend>
        <div className="cs-choice__options cs-choice__options--list">
          {options.map((clue) => (
            <label key={clue.id} className={cx('cs-option', 'cs-option--clue', evidence === clue.id && 'is-checked')}>
              <input type="radio" name="evidence" className="sr-only" checked={evidence === clue.id} onChange={() => setEvidence(clue.id)} />
              <span>{clue.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {feedback && (
        <p className="cs-feedback" role="alert">
          {feedback}
        </p>
      )}
      {hints.length > 0 && (
        <ul className="cs-hints" aria-label="Ayudas">
          {hints.map((hint) => (
            <li key={hint}>
              <Lightbulb aria-hidden="true" /> {hint}
            </li>
          ))}
        </ul>
      )}

      <div className="cs-deduction__actions">
        <Button icon={Gavel} disabled={!ready || !culprit || !evidence} onClick={() => onAccuse({ culprit, evidence })}>
          Presentar conclusión
        </Button>
        <Button variant="ghost" size="sm" icon={Lightbulb} disabled={hints.length >= caseData.hints.length} onClick={onHint}>
          Pedir una ayuda (−1 ★)
        </Button>
      </div>
    </div>
  );
}
