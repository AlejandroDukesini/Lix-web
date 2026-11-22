import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChefHat, Coins, Flame, FlipHorizontal2, Hand, Layers, ReceiptText, Send, ShoppingBag, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameOverlay, PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { recordGameResult } from '../../services/gameStorage.js';
import { cx } from '../../../../utils/cx.js';
import {
  DONENESS,
  GRADES,
  INGREDIENTS,
  UPGRADES,
  cookPatty,
  createDay,
  donenessLabel,
  evaluate,
  flipPatty,
  grillSlots,
  newIngredientsOn,
  newPatty,
  patienceFactor,
  pattyDoneness,
  summarizeDay,
  unlockedIngredients,
} from './engine/burgerEngine.js';
import { BurgerStack, Customer, Layer, PattyTop } from './components/BurgerParts.jsx';
import './styles/hamburgueseria.css';

const GAME_ID = 'hamburgueseria';
const SFX = {
  bell: [
    { wave: 'sine', from: 1568, dur: 0.18, gain: 0.07 },
    { wave: 'sine', from: 2093, dur: 0.3, gain: 0.05, delay: 0.05 },
  ],
  sizzle: { noise: true, from: 3000, to: 1800, dur: 0.35, gain: 0.03 },
  flip: { wave: 'triangle', from: 380, to: 560, dur: 0.08, gain: 0.07 },
  drop: { wave: 'sine', from: 440, to: 280, dur: 0.09, gain: 0.07 },
  remove: { wave: 'sine', from: 500, to: 300, dur: 0.08, gain: 0.05 },
  ding: { wave: 'sine', from: 1760, dur: 0.22, gain: 0.06 },
  take: { wave: 'triangle', from: 660, to: 880, dur: 0.1, gain: 0.06 },
  great: [
    { wave: 'triangle', from: 659, dur: 0.1, gain: 0.1 },
    { wave: 'triangle', from: 880, dur: 0.1, gain: 0.1, delay: 0.08 },
    { wave: 'triangle', from: 1175, dur: 0.22, gain: 0.1, delay: 0.16 },
  ],
  ok: { wave: 'triangle', from: 600, to: 760, dur: 0.18, gain: 0.08 },
  bad: { wave: 'square', from: 220, to: 150, dur: 0.25, gain: 0.05 },
  coins: { wave: 'triangle', from: 1320, to: 1760, dur: 0.12, gain: 0.06 },
};
const STATIONS = [
  { id: 'pedidos', label: 'Pedidos', icon: ReceiptText },
  { id: 'parrilla', label: 'Parrilla', icon: Flame },
  { id: 'montaje', label: 'Montaje', icon: Layers },
];
const TICK = 0.1; // segundos entre actualizaciones visibles de la cocina
const ZONE_COLORS = { cruda: '#d66068', poco: '#c27a5c', perfecta: '#4caf50', hecha: '#8a5a33', quemada: '#2a1d17' };

/* ---------------- Menú del restaurante: día, monedas y mejoras ---------------- */

function Shopfront({ progress, onStart, onBuy }) {
  const day = progress.day ?? 1;
  const coins = progress.coins ?? 0;
  const upgrades = progress.upgrades ?? {};
  const fresh = newIngredientsOn(day);
  return (
    <div className="bg-menu game-scroll">
      <header className="bg-menu__sign">
        <p className="eyebrow">Hamburguesería</p>
        <h2 className="bg-menu__title">La plancha de la esquina</h2>
        <p className="bg-menu__text">Toma los pedidos en el mostrador, cocina la carne en su punto, monta cada hamburguesa en orden y sírvela antes de que el cliente se impaciente.</p>
      </header>
      <section className="bg-menu__day" aria-labelledby="bg-day-title">
        <div>
          <h3 id="bg-day-title">Día {day}</h3>
          <p>
            {Math.min(8, 3 + day)} clientes · {unlockedIngredients(day).length - 2} ingredientes
            {day >= 3 ? ' · dobles y carne muy hecha' : ''}
          </p>
          {fresh.length > 0 && (
            <p className="bg-menu__new">
              <Sparkles aria-hidden="true" /> Nuevo hoy: {fresh.map((id) => INGREDIENTS[id].label).join(', ')}
            </p>
          )}
        </div>
        <Button size="lg" icon={ChefHat} onClick={onStart} data-autofocus>
          Abrir el local
        </Button>
      </section>
      <section className="bg-shop" aria-labelledby="bg-shop-title">
        <h3 id="bg-shop-title" className="bg-shop__title">
          <ShoppingBag aria-hidden="true" /> Mejoras de la cocina
          <span className="bg-coins" aria-label={`${coins} monedas`}>
            <Coins aria-hidden="true" /> {coins}
          </span>
        </h3>
        <ul className="bg-shop__list">
          {UPGRADES.map((u) => {
            const owned = Boolean(upgrades[u.id]);
            return (
              <li key={u.id} className={cx('bg-upgrade', owned && 'is-owned')}>
                <div>
                  <strong>{u.label}</strong>
                  <p>{u.text}</p>
                </div>
                {owned ? (
                  <span className="bg-upgrade__owned">Instalada</span>
                ) : (
                  <Button size="sm" variant="secondary" icon={Coins} disabled={coins < u.cost} onClick={() => onBuy(u)} aria-label={`Comprar ${u.label} por ${u.cost} monedas`}>
                    {u.cost}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      {(progress.served ?? 0) > 0 && (
        <p className="bg-menu__totals">
          {progress.served} hamburguesas servidas · {progress.excellent ?? 0} excelentes
        </p>
      )}
    </div>
  );
}

/* ---------------- Comanda ---------------- */

function Ticket({ order, waited, patience, active, compact, onSelect }) {
  const left = Math.max(0, 1 - waited / patience);
  const body = (
    <>
      <span className="bg-ticket__head">
        <strong>{order.customer}</strong>
        <span className={cx('bg-ticket__done', `is-${order.doneness}`)}>{donenessLabel(order.doneness)}</span>
      </span>
      <BurgerStack layers={order.layers} className="bg-ticket__burger" />
      {!compact && (
        <ol className="bg-ticket__list">
          {[...order.layers].reverse().map((id, i) => (
            <li key={`${i}-${id}`}>{INGREDIENTS[id].label}</li>
          ))}
        </ol>
      )}
      <span className={cx('bg-ticket__patience', left < 0.3 && 'is-low')} aria-hidden="true">
        <span style={{ transform: `scaleX(${left})` }} />
      </span>
    </>
  );
  const label = `Comanda de ${order.customer}: de abajo arriba ${order.layers.map((id) => INGREDIENTS[id].label).join(', ')}. Carne ${donenessLabel(order.doneness).toLowerCase()}.`;
  return onSelect ? (
    <button type="button" className={cx('bg-ticket', active && 'is-active', compact && 'is-compact')} onClick={onSelect} aria-pressed={active} aria-label={label}>
      {body}
    </button>
  ) : (
    <div className={cx('bg-ticket', compact && 'is-compact')} role="img" aria-label={label}>
      {body}
    </div>
  );
}

/* ---------------- Estaciones ---------------- */

function OrdersStation({ queue, seated, nextIn, onTake }) {
  const first = queue[0];
  return (
    <section className="bg-station bg-counter" aria-label="Mostrador de pedidos">
      <div className="bg-counter__scene">
        <div className="bg-counter__menuboard" aria-hidden="true">
          <span>MENÚ</span>
          <i />
          <i />
          <i />
        </div>
        <ul className="bg-counter__queue" aria-label={queue.length ? `${queue.length} en la cola` : 'Nadie en la cola'}>
          {queue.slice(0, 4).map((order, i) => (
            <li key={order.id} className={cx('bg-counter__person', i === 0 && 'is-first')} style={{ '--i': i }}>
              <Customer look={order.look} />
            </li>
          ))}
        </ul>
        {first && (
          <p className="bg-counter__bubble" aria-live="polite">
            ¡Hola! Soy {first.customer}, ¿me tomas el pedido?
          </p>
        )}
        <div className="bg-counter__desk" aria-hidden="true" />
      </div>
      <div className="bg-counter__actions">
        {first ? (
          <Button icon={ReceiptText} onClick={onTake} data-station-primary>
            Tomar el pedido de {first.customer}
          </Button>
        ) : (
          <p className="bg-counter__empty">{nextIn !== null ? `El próximo cliente llega en ${Math.ceil(nextIn)} s.` : 'Ya no quedan clientes por llegar hoy.'}</p>
        )}
        {seated > 0 && <p className="bg-counter__seated">{seated === 1 ? '1 cliente espera su hamburguesa' : `${seated} clientes esperan su hamburguesa`}</p>}
      </div>
    </section>
  );
}

function GrillStation({ grill, tray, bell, onPlace, onFlip, onTake }) {
  return (
    <section className="bg-station bg-grill" aria-label="Parrilla">
      <div className="bg-grill__plate">
        {grill.map((patty, slot) => {
          if (!patty) {
            return (
              <button key={slot} type="button" className="bg-grill__slot is-empty" onClick={() => onPlace(slot)} aria-label={`Hueco ${slot + 1} de la plancha: poner una carne`}>
                <span>+ Carne</span>
              </button>
            );
          }
          const down = patty.sides[patty.down];
          const ready = bell && down >= 0.6 && down < 0.85;
          const state = pattyDoneness(patty);
          return (
            <div key={slot} className={cx('bg-grill__slot', ready && 'is-ready')}>
              <PattyTop patty={patty} ready={ready} className="bg-grill__patty" />
              <span className="bg-grill__smoke" aria-hidden="true" />
              <div className="bg-grill__meters" role="group" aria-label={`Carne del hueco ${slot + 1}: ${donenessLabel(state).toLowerCase()}. Cara en la plancha al ${Math.round(down * 100)} %.`}>
                {[0, 1].map((side) => (
                  <span key={side} className={cx('bg-meter', patty.down === side && 'is-down')} title={side === patty.down ? 'Cara en la plancha' : 'Cara de arriba'}>
                    {DONENESS.slice(0, 4).map((z, i) => (
                      <i key={z.id} style={{ flexGrow: (z.to === Infinity ? 1.25 : z.to) - (i ? DONENESS[i - 1].to : 0), background: ZONE_COLORS[z.id] }} />
                    ))}
                    <b style={{ left: `${(Math.min(1.25, patty.sides[side]) / 1.25) * 100}%` }} />
                  </span>
                ))}
              </div>
              <span className="bg-grill__label">{donenessLabel(state)}</span>
              <span className="bg-grill__buttons">
                <Button size="sm" variant="secondary" icon={FlipHorizontal2} onClick={() => onFlip(slot)}>
                  Voltear
                </Button>
                <Button size="sm" icon={Hand} onClick={() => onTake(slot)}>
                  Retirar
                </Button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="bg-tray" aria-label="Bandeja de carnes listas">
        <p className="bg-tray__title">Bandeja</p>
        {tray.length ? (
          <ul className="bg-tray__list">
            {tray.map((p) => (
              <li key={p.id} className="bg-tray__item">
                <Layer id="carne" doneness={p.doneness} />
                <span>{donenessLabel(p.doneness)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bg-tray__empty">Retira aquí las carnes cocinadas: cada cara debe llegar a su punto.</p>
        )}
      </div>
    </section>
  );
}

function AssemblyStation({ ticket, waited, patience, tickets, activeId, build, available, tray, dropKey, onAdd, onAddPatty, onPop, onClear, onServe }) {
  const bins = available.filter((id) => id !== 'carne');
  return (
    <section className="bg-station bg-assembly" aria-label="Montaje">
      <div className="bg-assembly__ticket">
        {ticket ? (
          <Ticket order={ticket} waited={waited} patience={patience} />
        ) : (
          <p className="bg-assembly__none">{tickets.length ? 'Elige una comanda en la barra de arriba.' : 'Aún no hay comandas: toma un pedido en el mostrador.'}</p>
        )}
        {tickets.length > 1 && <p className="bg-assembly__switch">Toca otra comanda arriba para cambiar.</p>}
      </div>
      <div className="bg-assembly__board">
        <div className="bg-plate" aria-live="polite" aria-label={build.length ? `En el plato, de abajo arriba: ${build.map((b) => INGREDIENTS[b.id].label).join(', ')}` : 'Plato vacío'}>
          <BurgerStack key={dropKey} layers={build} animateLast className="bg-plate__burger" />
          <span className="bg-plate__dish" aria-hidden="true" />
        </div>
        <div className="bg-assembly__tools">
          <Button size="sm" variant="ghost" icon={Undo2} onClick={onPop} disabled={!build.length}>
            Quitar la última
          </Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={onClear} disabled={!build.length}>
            Vaciar
          </Button>
          <Button icon={Send} onClick={onServe} disabled={!ticket || !build.length}>
            Servir
          </Button>
        </div>
      </div>
      <div className="bg-bins" role="group" aria-label="Ingredientes">
        {tray.length ? (
          tray.map((p) => (
            <button key={p.id} type="button" className="bg-bin is-patty" onClick={() => onAddPatty(p.id)} aria-label={`Añadir carne ${donenessLabel(p.doneness).toLowerCase()}`}>
              <Layer id="carne" doneness={p.doneness} />
              <span>Carne · {donenessLabel(p.doneness)}</span>
            </button>
          ))
        ) : (
          <span className="bg-bin is-disabled">
            <Layer id="carne" doneness="cruda" />
            <span>Carne: cocínala en la parrilla</span>
          </span>
        )}
        {bins.map((id) => (
          <button key={id} type="button" className="bg-bin" onClick={() => onAdd(id)} aria-label={`Añadir ${INGREDIENTS[id].label.toLowerCase()}`}>
            <Layer id={id} />
            <span>{INGREDIENTS[id].label}</span>
          </button>
        ))}
      </div>
      {activeId === null && tickets.length > 0 && (
        <p className="sr-only" role="status">
          Elige una comanda para montar.
        </p>
      )}
    </section>
  );
}

/* ---------------- Jornada ---------------- */

function Shift({ day, progress, frame, onEnd }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const upgrades = progress.upgrades ?? {};
  const plan = useMemo(() => createDay(day), [day]);
  const factor = patienceFactor(upgrades);
  const [now, setNow] = useState(0);
  const [taken, setTaken] = useState({}); // id → segundo en que se tomó
  const [served, setServed] = useState([]); // resultados
  const [station, setStation] = useState('pedidos');
  const [grill, setGrill] = useState(() => Array(grillSlots(upgrades)).fill(null));
  const [tray, setTray] = useState([]);
  const [build, setBuild] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [summary, setSummary] = useState(null);
  const acc = useRef(0);
  const pattySeq = useRef(0);
  const dropKey = useRef(0);
  const { start, finish } = session;

  useEffect(() => {
    start();
  }, [start]);
  useInProgress(!summary);
  usePauseOnInterrupt(session.pause);

  const servedIds = useMemo(() => new Set(served.map((r) => r.orderId)), [served]);
  const arrived = plan.orders.filter((o) => o.arrivesAt <= now);
  const queue = arrived.filter((o) => taken[o.id] === undefined);
  const tickets = arrived.filter((o) => taken[o.id] !== undefined && !servedIds.has(o.id));
  const upcoming = plan.orders.find((o) => o.arrivesAt > now);
  const activeTicket = tickets.find((t) => t.id === activeId) ?? null;
  const patienceOf = (o) => o.patience * factor;

  // Si la comanda activa se sirvió, se pasa a la siguiente.
  useEffect(() => {
    if (activeId !== null && !tickets.some((t) => t.id === activeId)) setActiveId(tickets[0]?.id ?? null);
  }, [activeId, tickets]);

  // Al llegar un cliente nuevo suena la campanilla de la puerta.
  const arrivedCount = arrived.length;
  const lastArrived = useRef(0);
  useEffect(() => {
    if (arrivedCount > lastArrived.current) audio.play(SFX.bell);
    lastArrived.current = arrivedCount;
  }, [arrivedCount, audio]);

  const running = session.isPlaying && !feedback && !summary;
  useGameLoop((dt) => {
    acc.current += dt;
    if (acc.current < TICK) return;
    const step = acc.current;
    acc.current = 0;
    setNow((t) => t + step);
    setGrill((slots) =>
      slots.map((p) => {
        if (!p) return p;
        const next = cookPatty(p, step);
        const before = p.sides[p.down];
        const after = next.sides[p.down];
        if (upgrades.campana && before < 0.6 && after >= 0.6) audio.play(SFX.ding);
        return next;
      }),
    );
  }, running);

  const takeOrder = useCallback(() => {
    const first = queue[0];
    if (!first) return;
    audio.play(SFX.take);
    setTaken((t) => ({ ...t, [first.id]: now }));
    setActiveId((id) => id ?? first.id);
  }, [queue, now, audio]);

  const placePatty = (slot) => {
    pattySeq.current += 1;
    audio.play(SFX.sizzle);
    setGrill((g) => g.map((p, i) => (i === slot ? newPatty(`c${pattySeq.current}`) : p)));
  };
  const flip = (slot) => {
    audio.play(SFX.flip);
    setGrill((g) => g.map((p, i) => (i === slot && p ? flipPatty(p) : p)));
  };
  const takePatty = (slot) => {
    const p = grill[slot];
    if (!p) return;
    audio.play(SFX.remove);
    setTray((t) => [...t, { id: p.id, doneness: pattyDoneness(p) }]);
    setGrill((g) => g.map((x, i) => (i === slot ? null : x)));
  };

  const add = (id) => {
    audio.play(SFX.drop);
    dropKey.current += 1;
    setBuild((b) => [...b, { id }]);
  };
  const addPatty = (pid) => {
    const p = tray.find((x) => x.id === pid);
    if (!p) return;
    audio.play(SFX.drop);
    dropKey.current += 1;
    setTray((t) => t.filter((x) => x.id !== pid));
    setBuild((b) => [...b, { id: 'carne', doneness: p.doneness, pid: p.id }]);
  };
  const pop = () => {
    const last = build.at(-1);
    if (!last) return;
    audio.play(SFX.remove);
    if (last.id === 'carne') setTray((t) => [...t, { id: last.pid, doneness: last.doneness }]);
    setBuild((b) => b.slice(0, -1));
  };
  const clear = () => {
    audio.play(SFX.remove);
    const patties = build.filter((b) => b.id === 'carne').map((b) => ({ id: b.pid, doneness: b.doneness }));
    setTray((t) => [...t, ...patties]);
    setBuild([]);
  };

  const serve = () => {
    if (!activeTicket || !build.length) return;
    const waited = now - activeTicket.arrivesAt;
    const result = evaluate({ ...activeTicket, patience: patienceOf(activeTicket) }, build, waited);
    audio.play(result.grade === 'excelente' || result.grade === 'muy-bien' ? SFX.great : result.grade === 'correcto' ? SFX.ok : SFX.bad);
    if (result.coins) audio.play({ ...SFX.coins, delay: 0.35 });
    const entry = { ...result, orderId: activeTicket.id, customer: activeTicket.customer, look: activeTicket.look, build };
    setServed((s) => [...s, entry]);
    setBuild([]);
    setFeedback(entry);
  };

  const closeFeedback = async () => {
    setFeedback(null);
    if (served.length < plan.orders.length) return;
    const sum = summarizeDay(served);
    setSummary({ ...sum, saving: true });
    const saved = await finish({
      completed: true,
      marks: [
        { key: 'average', value: Math.round(sum.average), better: 'higher' },
        { key: 'coins-day', value: sum.coins, better: 'higher' },
      ],
      progress: (p) => ({
        ...p,
        day: Math.max(p.day ?? 1, day + 1),
        coins: (p.coins ?? 0) + sum.coins,
        served: (p.served ?? 0) + sum.served,
        excellent: (p.excellent ?? 0) + sum.excellent,
        days: { ...(p.days ?? {}), [day]: Math.max(p.days?.[day] ?? 0, sum.stars) },
      }),
    });
    setSummary({ ...sum, saving: false, mark: saved.marks?.average });
  };

  useKeyboard({
    active: !summary && !feedback,
    onAction: (action) => {
      if (action === 'pause') session.togglePause();
    },
  });
  useEffect(() => {
    if (summary || feedback) return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0) setStation(STATIONS[index].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [summary, feedback]);

  const readyCount = tray.length;
  const cooking = grill.filter(Boolean).length;
  const badges = { pedidos: queue.length, parrilla: cooking + readyCount, montaje: tickets.length };
  const coinsToday = served.reduce((a, r) => a + r.coins, 0);
  const lowTickets = tickets.filter((t) => now - t.arrivesAt > patienceOf(t) * 0.75).length;

  return (
    <div className="bg-play">
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(summary)}
        items={[
          { id: 'day', label: 'Día', value: String(day) },
          { id: 'served', label: 'Servidos', value: `${served.length}/${plan.orders.length}` },
          { id: 'coins', label: 'Monedas', value: String((progress.coins ?? 0) + coinsToday) },
        ]}
      />
      <div className="bg-rail" role="group" aria-label="Comandas abiertas">
        {tickets.length ? (
          tickets.map((t) => (
            <Ticket
              key={t.id}
              order={t}
              compact
              waited={now - t.arrivesAt}
              patience={patienceOf(t)}
              active={t.id === activeId}
              onSelect={() => {
                setActiveId(t.id);
                setStation('montaje');
              }}
            />
          ))
        ) : (
          <p className="bg-rail__empty">Sin comandas abiertas</p>
        )}
      </div>
      <div className="bg-stage">
        {station === 'pedidos' && <OrdersStation queue={queue} seated={tickets.length} nextIn={upcoming ? upcoming.arrivesAt - now : null} onTake={takeOrder} />}
        {station === 'parrilla' && <GrillStation grill={grill} tray={tray} bell={Boolean(upgrades.campana)} onPlace={placePatty} onFlip={flip} onTake={takePatty} />}
        {station === 'montaje' && (
          <AssemblyStation
            ticket={activeTicket}
            waited={activeTicket ? now - activeTicket.arrivesAt : 0}
            patience={activeTicket ? patienceOf(activeTicket) : 1}
            tickets={tickets}
            activeId={activeId}
            build={build}
            available={unlockedIngredients(day)}
            tray={tray}
            dropKey={dropKey.current}
            onAdd={add}
            onAddPatty={addPatty}
            onPop={pop}
            onClear={clear}
            onServe={serve}
          />
        )}
      </div>
      <nav className="bg-tabs" aria-label="Estaciones">
        {STATIONS.map(({ id, label, icon: Icon }, i) => (
          <button key={id} type="button" className={cx('bg-tab', station === id && 'is-current')} aria-current={station === id ? 'page' : undefined} onClick={() => setStation(id)}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <kbd aria-hidden="true">{i + 1}</kbd>
            {badges[id] > 0 && (
              <span className={cx('bg-tab__badge', id === 'montaje' && lowTickets && 'is-warn')} aria-label={`(${badges[id]})`}>
                {badges[id]}
              </span>
            )}
          </button>
        ))}
      </nav>

      {session.isPaused && !summary && <PauseMenu onResume={session.resume} onExit={frame.exit}><p>La cocina se ha detenido: nada se quema mientras tanto.</p></PauseMenu>}

      {feedback && (
        <GameOverlay
          tone={GRADES[feedback.grade].tone}
          eyebrow={`${feedback.customer} prueba su hamburguesa`}
          title={GRADES[feedback.grade].label}
          className="bg-feedback"
          actions={
            <Button icon={ArrowRight} onClick={closeFeedback} data-autofocus>
              {served.length >= plan.orders.length ? 'Cerrar el local' : 'Seguir cocinando'}
            </Button>
          }
        >
          <div className="bg-feedback__scene">
            <Customer look={feedback.look} mood={feedback.total >= 75 ? 'happy' : feedback.total >= 55 ? 'ok' : 'angry'} className="bg-feedback__customer" />
            <BurgerStack layers={feedback.build} className="bg-feedback__burger" />
          </div>
          <p className="bg-feedback__score">
            <strong>{feedback.total}</strong>/100 · <Coins aria-hidden="true" /> +{feedback.coins}
            {feedback.tip > 0 ? ` (propina ${feedback.tip})` : ''}
          </p>
          <dl className="bg-feedback__scores">
            {[
              ['Ingredientes', feedback.scores.ingredients],
              ['Orden', feedback.scores.order],
              ['Cocción', feedback.scores.cooking],
              ['Tiempo', feedback.scores.time],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <span className="bg-bar" aria-hidden="true">
                    <span style={{ transform: `scaleX(${value})` }} />
                  </span>
                  {Math.round(value * 100)} %
                </dd>
              </div>
            ))}
          </dl>
          <ul className="bg-feedback__items">
            {feedback.items.map((item, i) => (
              <li key={i} className={`is-${item.status}`}>
                {{ ok: 'Correcto', partial: 'Casi', wrong: 'Mal', missing: 'Falta', extra: 'Sobra' }[item.status]} · {item.text}
              </li>
            ))}
          </ul>
        </GameOverlay>
      )}

      {summary && (
        <GameResults
          outcome="win"
          eyebrow={`Día ${day} cerrado · ${'★'.repeat(summary.stars)}${'☆'.repeat(3 - summary.stars)}`}
          title={`${summary.coins} monedas`}
          message={`Nota media ${Math.round(summary.average)}/100 con ${summary.served} clientes. ${summary.excellent ? `${summary.excellent} ${summary.excellent === 1 ? 'pedido excelente' : 'pedidos excelentes'}.` : 'Afina la cocción para llegar a «Excelente».'}`}
          saving={summary.saving}
          stats={[
            { label: 'Nota media', value: `${Math.round(summary.average)}`, record: summary.mark?.isRecord && summary.mark.previous !== null },
            { label: 'Excelentes', value: `${summary.excellent}/${summary.served}` },
          ]}
          onReplay={onEnd}
          replayLabel="Al restaurante"
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Hamburguesería: menú del local (día, monedas, mejoras) y jornada por estaciones. */
export default function Hamburgueseria() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [playingDay, setPlayingDay] = useState(null);
  const progress = record?.progress ?? {};
  const buy = (upgrade) => {
    if ((progress.coins ?? 0) < upgrade.cost || progress.upgrades?.[upgrade.id]) return;
    recordGameResult(GAME_ID, {
      durationMs: 0,
      progress: (p) => (p.upgrades?.[upgrade.id] || (p.coins ?? 0) < upgrade.cost ? p : { ...p, coins: p.coins - upgrade.cost, upgrades: { ...(p.upgrades ?? {}), [upgrade.id]: true } }),
    }).catch(() => {});
  };
  if (playingDay === null) return <Shopfront progress={progress} onStart={() => setPlayingDay(progress.day ?? 1)} onBuy={buy} />;
  return <Shift key={playingDay} day={playingDay} progress={progress} frame={frame} onEnd={() => setPlayingDay(null)} />;
}

