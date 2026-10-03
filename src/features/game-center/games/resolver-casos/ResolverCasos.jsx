import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Gavel, Lock, RotateCcw, Search, Star } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { ConfirmDialog } from '../../../../components/common/Dialog.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress } from '../../hooks/useGameFrame.js';
import { cx } from '../../../../utils/cx.js';
import { CASES } from './cases/cases.js';
import { MAX_STARS, accuse, clueOf, createInvestigation, examine, interview, starsFor, takeHint } from './engine/caseEngine.js';
import { SceneView } from './components/SceneView.jsx';
import { Notebook } from './components/Notebook.jsx';
import { Deduction } from './components/Deduction.jsx';
import './styles/cases.css';

const GAME_ID = 'resolver-casos';
const SFX = {
  clue: { wave: 'triangle', from: 660, to: 990, dur: 0.12, gain: 0.1 },
  wrong: { wave: 'square', from: 220, to: 150, dur: 0.25, gain: 0.08 },
  solved: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.14 },
    { wave: 'triangle', from: 659, dur: 0.14, gain: 0.14, delay: 0.12 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.14, delay: 0.24 },
  ],
};

const isUnlocked = (index, solved) => index === 0 || Boolean(solved[CASES[index - 1].id]);

function Stars({ value, label }) {
  return (
    <span className="cs-stars" aria-label={label ?? `${value} de ${MAX_STARS} estrellas`}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Star key={i} aria-hidden="true" className={i < value ? 'is-on' : undefined} />
      ))}
    </span>
  );
}

function CaseSelect({ solved, onPick }) {
  return (
    <div className="cs-select game-scroll">
      <header className="cs-select__head">
        <p className="eyebrow">Resolver casos</p>
        <h2 className="cs-select__title">Expedientes abiertos</h2>
        <p className="cs-select__text">
          Examina el escenario, interroga a los implicados y señala quién miente y con qué prueba. Cada caso resuelto abre el siguiente.
        </p>
      </header>
      <ol className="cs-cases">
        {CASES.map((item, index) => {
          const unlocked = isUnlocked(index, solved);
          const stars = solved[item.id];
          return (
            <li key={item.id}>
              <button
                type="button"
                className={cx('cs-case', stars && 'is-done', !unlocked && 'is-locked')}
                disabled={!unlocked}
                onClick={() => onPick(item)}
                aria-label={`Caso ${index + 1}: ${item.title}. Dificultad ${item.difficulty} de 5.${stars ? ` Resuelto con ${stars} estrellas.` : ''}${unlocked ? '' : ' Bloqueado.'}`}
              >
                <span className="cs-case__number">{index + 1}</span>
                <span className="cs-case__body">
                  <span className="cs-case__title">{item.title}</span>
                  <span className="cs-case__place">{item.place}</span>
                </span>
                <span className="cs-case__meta">
                  {!unlocked ? <Lock aria-hidden="true" /> : stars ? <Stars value={stars} /> : <span className="cs-difficulty" aria-hidden="true">{'●'.repeat(item.difficulty)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const TABS = [
  { id: 'scene', label: 'Escena', icon: Search },
  { id: 'notebook', label: 'Expediente', icon: BookOpen },
  { id: 'solve', label: 'Resolver', icon: Gavel },
];

function Investigation({ caseData, onCases, onNext, frame }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [state, setState] = useState(createInvestigation);
  const [tab, setTab] = useState('scene');
  const [notice, setNotice] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [hints, setHints] = useState([]);
  const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'restart' | 'leave'
  const { start, finish } = session;

  useEffect(() => {
    start();
  }, [start]);
  // Mientras se investiga, salir pide confirmación (no se pierde el expediente por accidente).
  useInProgress(!result && state.found.length > 0);

  const announce = (ids) => {
    const fresh = ids.map((id) => clueOf(caseData, id)).filter(Boolean);
    if (!fresh.length) return;
    audio.play(SFX.clue);
    setNotice({ key: Date.now(), text: fresh.map((c) => c.title).join(' · ') });
  };

  const onExamine = (spotId) => {
    const outcome = examine(state, caseData, spotId);
    setState(outcome.state);
    const clue = clueOf(caseData, outcome.clue);
    setNotice({ key: Date.now(), text: `${outcome.isNew ? 'Pista nueva' : 'Ya en el expediente'}: ${clue.title}. ${clue.text}`, clue: outcome.clue });
    if (outcome.isNew) audio.play(SFX.clue);
  };

  const onInterview = (personId) => {
    const before = state.found;
    const outcome = interview(state, caseData, personId);
    setState(outcome.state);
    announce(outcome.clues.filter((id) => !before.includes(id) && clueOf(caseData, id).kind !== 'testimony'));
  };

  const onHint = () => {
    const outcome = takeHint(state, caseData);
    if (!outcome.hint) return;
    setState(outcome.state);
    setHints((list) => [...list, outcome.hint]);
  };

  const onAccuse = async (choice) => {
    const outcome = accuse(state, caseData, choice);
    setState(outcome.state);
    if (!outcome.correct) {
      audio.play(SFX.wrong);
      setFeedback('La conclusión no coincide con las evidencias. Repasa las declaraciones y comprueba qué prueba contradice a quién. No has perdido nada de lo investigado.');
      return;
    }
    audio.play(SFX.solved);
    setFeedback(null);
    const stars = starsFor(outcome.state);
    setResult({ stars, saving: true });
    await finish({
      completed: true,
      marks: [{ key: `stars:${caseData.id}`, value: stars, better: 'higher' }],
      progress: (p) => ({ ...p, solved: { ...(p.solved ?? {}), [caseData.id]: Math.max(p.solved?.[caseData.id] ?? 0, stars) } }),
    });
    setResult({ stars, saving: false });
  };

  const restart = useCallback(() => {
    setState(createInvestigation());
    setHints([]);
    setFeedback(null);
    setNotice(null);
    setTab('scene');
    setConfirm(null);
  }, []);

  // Volver a la lista con el expediente empezado pide confirmación.
  const leave = () => (state.found.length && !result ? setConfirm('leave') : onCases());

  const { evidence, requires, explanation } = caseData.solution;
  const keyClues = [...evidence, ...requires.filter((id) => !evidence.includes(id) && clueOf(caseData, id).kind !== 'testimony')];

  return (
    <div className="cs-play game-scroll">
      <header className="cs-play__head">
        <button type="button" className="cs-back" onClick={leave}>
          <ArrowLeft aria-hidden="true" /> Casos
        </button>
        <div className="cs-play__titles">
          <h2 className="cs-play__title">{caseData.title}</h2>
          <p className="cs-play__place">{caseData.place}</p>
        </div>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setConfirm('restart')} disabled={Boolean(result)}>
          <span className="cs-hide-narrow">Empezar de nuevo</span>
        </Button>
      </header>
      <p className="cs-play__intro">{caseData.intro}</p>

      <div className="cs-tabs" role="tablist" aria-label="Investigación">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`cs-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`cs-panel-${id}`}
            className={cx('cs-tab', tab === id && 'is-active', id === 'scene' && 'cs-tab--scene')}
            onClick={() => setTab(id)}
          >
            <Icon aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className={cx('cs-layout', `shows-${tab}`)}>
        <section id="cs-panel-scene" role="tabpanel" aria-labelledby="cs-tab-scene" className="cs-panel cs-panel--scene">
          <SceneView caseData={caseData} found={state.found} lastClue={notice?.clue} onExamine={onExamine} />
          <p className="cs-notice" role="status" aria-live="polite">
            {notice ? <span key={notice.key}>{notice.text}</span> : 'Toca los objetos del escenario para examinarlos.'}
          </p>
        </section>
        <section id="cs-panel-notebook" role="tabpanel" aria-labelledby="cs-tab-notebook" className="cs-panel cs-panel--notebook">
          <Notebook caseData={caseData} state={state} onInterview={onInterview} />
        </section>
        <section id="cs-panel-solve" role="tabpanel" aria-labelledby="cs-tab-solve" className="cs-panel cs-panel--solve">
          <Deduction caseData={caseData} state={state} feedback={feedback} hints={hints} onAccuse={onAccuse} onHint={onHint} />
        </section>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'leave' ? '¿Dejar este caso?' : '¿Empezar el caso de nuevo?'}
        description="Se vaciará el expediente de este caso: pistas, declaraciones y ayudas."
        confirmLabel={confirm === 'leave' ? 'Dejar el caso' : 'Empezar de nuevo'}
        cancelLabel="Seguir investigando"
        onConfirm={confirm === 'leave' ? onCases : restart}
        onCancel={() => setConfirm(null)}
      />

      {result && (
        <GameResults
          outcome="win"
          eyebrow="Caso resuelto"
          title={caseData.title}
          message={`${explanation} Pistas clave: ${keyClues.map((id) => clueOf(caseData, id).title).join(', ')}.`}
          saving={result.saving}
          stats={[
            { label: 'Estrellas', value: `${result.stars}/${MAX_STARS}` },
            { label: 'Errores', value: String(state.attempts) },
            { label: 'Ayudas', value: String(state.hints) },
          ]}
          onReplay={onNext ?? onCases}
          replayLabel={onNext ? 'Siguiente caso' : 'Ver los casos'}
          extraActions={
            onNext && (
              <Button variant="secondary" icon={Check} onClick={onCases}>
                Ver los casos
              </Button>
            )
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Resolver casos: lista de expedientes e investigación. */
export default function ResolverCasos() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [current, setCurrent] = useState(null);
  const solved = record?.progress?.solved ?? {};
  const index = current ? CASES.indexOf(current) : -1;
  const next = index >= 0 ? CASES[index + 1] ?? null : null;

  if (!current) return <CaseSelect solved={solved} onPick={setCurrent} />;
  return <Investigation key={current.id} caseData={current} frame={frame} onCases={() => setCurrent(null)} onNext={next ? () => setCurrent(next) : null} />;
}
