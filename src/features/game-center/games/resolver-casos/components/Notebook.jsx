import { FileText, MessageSquareQuote, Search } from 'lucide-react';
import { Button } from '../../../../../components/common/Button.jsx';
import { cx } from '../../../../../utils/cx.js';
import { clueOf, reachableClues } from '../engine/caseEngine.js';

const KIND = {
  object: { icon: Search, label: 'Objeto' },
  document: { icon: FileText, label: 'Documento' },
  testimony: { icon: MessageSquareQuote, label: 'Declaración' },
};

/** Inicial con el color de la persona (retratos propios, sin imágenes externas). */
export function Avatar({ person }) {
  return (
    <span className="cs-avatar" style={{ '--hue': person.hue }} aria-hidden="true">
      {person.name[0]}
    </span>
  );
}

/** Expediente: personas (interrogar), pistas encontradas y lo que queda por descubrir. */
export function Notebook({ caseData, state, onInterview }) {
  const total = reachableClues(caseData).size;
  const clues = state.found.map((id) => ({ id, ...clueOf(caseData, id) })).filter((clue) => clue.kind !== 'testimony');
  const pendingSpots = caseData.scene.hotspots.filter((spot) => !state.found.includes(spot.clue)).length;
  const pendingPeople = caseData.people.filter((p) => !state.interviewed.includes(p.id)).length;

  return (
    <div className="cs-notebook">
      <p className="cs-notebook__progress">
        <strong>
          {state.found.length}/{total}
        </strong>{' '}
        pistas en el expediente
        {pendingSpots + pendingPeople > 0 && (
          <span>
            {' '}
            · pendiente: {pendingSpots > 0 && `${pendingSpots} ${pendingSpots === 1 ? 'objeto' : 'objetos'}`}
            {pendingSpots > 0 && pendingPeople > 0 && ' y '}
            {pendingPeople > 0 && `${pendingPeople} ${pendingPeople === 1 ? 'persona' : 'personas'}`}
          </span>
        )}
      </p>

      <section aria-labelledby="cs-people-title">
        <h3 id="cs-people-title" className="cs-notebook__title">
          Personas implicadas
        </h3>
        <ul className="cs-people">
          {caseData.people.map((person) => {
            const heard = state.interviewed.includes(person.id);
            return (
              <li key={person.id} className={cx('cs-person', heard && 'is-heard')}>
                <Avatar person={person} />
                <div className="cs-person__body">
                  <p className="cs-person__name">
                    {person.name} <span>{person.role}</span>
                  </p>
                  {heard ? (
                    <blockquote className="cs-person__statement">«{person.statement}»</blockquote>
                  ) : (
                    <Button size="sm" variant="secondary" icon={MessageSquareQuote} onClick={() => onInterview(person.id)}>
                      Interrogar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="cs-clues-title">
        <h3 id="cs-clues-title" className="cs-notebook__title">
          Pistas
        </h3>
        {clues.length ? (
          <ul className="cs-clues">
            {clues.map((clue) => {
              const { icon: Icon, label } = KIND[clue.kind];
              return (
                <li key={clue.id} className="cs-clue">
                  <Icon aria-hidden="true" />
                  <div>
                    <p className="cs-clue__title">
                      {clue.title} <span>{label}</span>
                    </p>
                    <p className="cs-clue__text">{clue.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="cs-empty">Aún no has encontrado pistas. Examina los objetos del escenario.</p>
        )}
      </section>
    </div>
  );
}

/** Lista de pruebas elegibles para la conclusión: todo lo del expediente salvo las declaraciones. */
export function evidenceOptions(caseData, state) {
  return state.found.map((id) => ({ id, ...clueOf(caseData, id) })).filter((clue) => clue.kind !== 'testimony');
}
