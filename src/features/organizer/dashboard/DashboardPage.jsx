import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  CalendarDays,
  Feather,
  GraduationCap,
  HeartPulse,
  History,
  ListTodo,
  PiggyBank,
  ReceiptText,
  Settings2,
  StickyNote,
  Wallet,
  Zap,
} from 'lucide-react';
import { Button, IconButton } from '../../../components/common/Button.jsx';
import { Switch } from '../../../components/common/Switch.jsx';
import { Dialog } from '../../../components/common/Dialog.jsx';
import { useKind, useRunner, useSettings } from '../data/hooks.js';
import { createRecord, saveSettings } from '../data/store.js';
import { addDays } from '../data/recurrence.js';
import { DASHBOARD_WIDGETS } from '../data/entities.js';
import { ModuleLayout, Progress } from '../shared/ui.jsx';
import { daysFromToday, formatClock, relativeTime, shortDate } from '../shared/format.js';
import { excerpt } from '../shared/text.js';
import { useLocked } from '../shared/PrivacyGate.jsx';
import { usePlanner } from '../planner/usePlanner.js';
import { PlannerActions } from '../planner/PlannerContext.js';
import { AgendaItem } from '../planner/views/CalendarView.jsx';
import { TaskRow } from '../planner/views/Tasks.jsx';
import { ACTIVITY_LABELS } from '../planner/agenda.js';
import { useFinance } from '../finance/useFinance.js';
import { budgetStatus, dueOccurrences, goalProgress, overview, periodRange, summarize } from '../finance/ledger.js';
import { formatMoney } from '../finance/money.js';
import { OccurrenceActions } from '../finance/views/Scheduled.jsx';
import '../shared/organizer.css';
import '../planner/planner.css';
import './dashboard.css';

function Widget({ id, icon: Icon, title, link, linkLabel = 'Abrir', children }) {
  return (
    <section className="org-panel org-widget" aria-labelledby={`w-${id}`}>
      <header className="org-widget__head">
        <h2 id={`w-${id}`} className="org-widget__title">
          <Icon aria-hidden="true" />
          {title}
        </h2>
        {link && (
          <Link to={link} className="org-widget__link">
            {linkLabel}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function TodayWidget() {
  const planner = usePlanner();
  const items = planner.agenda(planner.today, planner.today, { payment: false }).filter((i) => i.status !== 'cancelled');
  return (
    <Widget id="today" icon={CalendarDays} title="Hoy" link="/calendario" linkLabel="Calendario">
      {items.length ? (
        <ul className="org-list">
          {items.map((item) => (
            <li key={item.key}>
              <AgendaItem item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="org-muted">Nada programado para hoy.</p>
      )}
      <Button size="sm" variant="secondary" icon={CalendarPlus} to="/calendario?nuevo=evento">
        Nuevo evento
      </Button>
    </Widget>
  );
}

function UniversityWidget() {
  const planner = usePlanner();
  const until = addDays(planner.today, 14);
  const classes = planner.agenda(planner.today, addDays(planner.today, 7), { event: false, task: false, activity: false, payment: false }).filter((c) => c.date > planner.today || (c.endTime ?? c.startTime) >= new Date().toTimeString().slice(0, 5)).slice(0, 3);
  const activities = planner.activities.filter((a) => (a.status === 'pending' || a.status === 'in_progress') && a.dueDate <= until).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  if (!planner.subjects.length && !planner.activities.length) {
    return (
      <Widget id="university" icon={GraduationCap} title="Universidad">
        <p className="org-muted">Añade tus materias con su horario y aquí verás tus próximas clases y entregas.</p>
        <Button size="sm" variant="secondary" to="/calendario/universidad">
          Añadir materias
        </Button>
      </Widget>
    );
  }
  return (
    <Widget id="university" icon={GraduationCap} title="Clases y entregas" link="/calendario/universidad" linkLabel="Universidad">
      {classes.length > 0 && (
        <ul className="org-mini-list">
          {classes.map((c) => (
            <li key={c.key}>
              <span>
                <span className="org-dot" style={{ '--dot-color': c.color }} aria-hidden="true" /> {c.title}
                {c.location && <span className="org-subtle"> · {c.location}</span>}
              </span>
              <span className="org-subtle">
                {c.date === planner.today ? 'Hoy' : shortDate(c.date)} {formatClock(c.startTime, planner.hourCycle)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {activities.length ? (
        <ul className="org-mini-list">
          {activities.map((a) => (
            <li key={a.id}>
              <span>
                {ACTIVITY_LABELS[a.type]}: {a.title}
              </span>
              <span className={a.dueDate < planner.today ? 'is-negative' : 'org-subtle'}>{daysFromToday(a.dueDate, planner.today)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="org-muted">Sin entregas ni exámenes en las próximas dos semanas.</p>
      )}
    </Widget>
  );
}

function TasksWidget() {
  const planner = usePlanner();
  const open = planner.tasks
    .filter((t) => t.status === 'todo' || t.status === 'doing')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || { high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority]);
  return (
    <Widget id="tasks" icon={ListTodo} title={`Tareas pendientes${open.length ? ` (${open.length})` : ''}`} link="/calendario/tareas" linkLabel="Todas">
      {open.length ? (
        <ul className="org-list">
          {open.slice(0, 5).map((task) => (
            <TaskRow key={task.id} task={task} compact />
          ))}
        </ul>
      ) : (
        <p className="org-muted">No hay tareas pendientes.</p>
      )}
      <Button size="sm" variant="secondary" to="/calendario?nuevo=tarea">
        Nueva tarea
      </Button>
    </Widget>
  );
}

function FinanceWidget() {
  const finance = useFinance();
  if (!finance.accounts.length) {
    return (
      <Widget id="finance" icon={Wallet} title="Finanzas">
        <p className="org-muted">Crea tu primera cuenta para ver aquí tu saldo y tus gastos del mes.</p>
        <Button size="sm" variant="secondary" to="/finanzas/cuentas">
          Crear una cuenta
        </Button>
      </Widget>
    );
  }
  const range = periodRange('month', finance.today, finance.periodOptions);
  const general = overview(finance.accounts, finance.transactions, finance.today, finance.currency);
  const month = summarize(finance.transactions, range.from, range.to, { accountIds: finance.mainAccountIds, categoriesById: finance.categoriesById });
  const budget = finance.budgets.find((b) => !b.archived && !b.categoryId && b.period === 'monthly');
  const status = budget ? budgetStatus(budget, finance.transactions, finance.categoriesById, finance.today, { ...finance.periodOptions, accountIds: finance.mainAccountIds }) : null;
  const fmt = (v) => formatMoney(v, finance.currency);
  return (
    <Widget id="finance" icon={Wallet} title="Finanzas" link="/finanzas" linkLabel="Resumen">
      <dl className="org-figures org-figures--compact">
        <div className="org-figure">
          <dt className="org-figure__label">Disponible</dt>
          <dd className="org-figure__value">{fmt(general.available)}</dd>
        </div>
        <div className="org-figure org-figure--positive">
          <dt className="org-figure__label">Ingresos del mes</dt>
          <dd className="org-figure__value">{fmt(month.income)}</dd>
        </div>
        <div className="org-figure org-figure--negative">
          <dt className="org-figure__label">Gastos del mes</dt>
          <dd className="org-figure__value">{fmt(month.expense)}</dd>
        </div>
      </dl>
      {status && (
        <>
          <p className="org-subtle">
            Presupuesto: {fmt(status.spent)} de {fmt(status.limit)}
          </p>
          <Progress value={status.spent} max={status.limit} label="Presupuesto del mes" tone={status.state} showValue />
        </>
      )}
      <Button size="sm" variant="secondary" icon={Zap} to="/finanzas?nuevo=gasto">
        Gasto rápido
      </Button>
    </Widget>
  );
}

function PaymentsWidget() {
  const finance = useFinance();
  const due = dueOccurrences(finance.scheduled, finance.transactions, finance.today, addDays(finance.today, 14), 30).slice(0, 5);
  return (
    <Widget id="payments" icon={ReceiptText} title="Pagos próximos" link="/finanzas/pagos" linkLabel="Todos">
      {due.length ? (
        <ul className="org-list">
          {due.map((occ) => (
            <li key={`${occ.item.id}-${occ.date}`} className="org-row org-row--compact">
              <span className="org-dot" style={{ '--dot-color': occ.state === 'overdue' ? 'var(--danger)' : 'var(--c-accent)' }} aria-hidden="true" />
              <span className="org-row__main">
                <span className="org-row__title">{occ.item.name}</span>
                <span className="org-row__meta">
                  <span className={occ.state === 'overdue' ? 'is-negative' : undefined}>
                    {occ.state === 'overdue' ? 'Vencido' : 'Vence'} {daysFromToday(occ.date, finance.today)}
                  </span>
                  <span>{formatMoney(occ.item.amount, finance.currencyOf(occ.item.accountId))}</span>
                </span>
              </span>
              <OccurrenceActions occurrence={occ} compact />
            </li>
          ))}
        </ul>
      ) : (
        <p className="org-muted">{finance.scheduled.length ? 'Nada por pagar en las próximas dos semanas.' : 'Registra suscripciones, matrícula o servicios en Finanzas → Pagos.'}</p>
      )}
    </Widget>
  );
}

function GoalsWidget() {
  const finance = useFinance();
  const goals = finance.goals.filter((g) => g.status === 'active');
  return (
    <Widget id="goals" icon={PiggyBank} title="Metas de ahorro" link="/finanzas/metas" linkLabel="Metas">
      {goals.length ? (
        <ul className="org-stack org-goals-mini">
          {goals.slice(0, 4).map((g) => {
            const p = goalProgress(g, finance.transactions);
            return (
              <li key={g.id}>
                <p className="org-row__title">
                  {g.name} <span className="org-subtle">{formatMoney(p.saved, finance.currency)} de {formatMoney(g.target, finance.currency)}</span>
                </p>
                <Progress value={p.saved} max={g.target} label={`Progreso de ${g.name}`} tone={p.reached ? 'done' : 'ok'} showValue />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="org-muted">Sin metas activas. Ponle nombre y cifra a algo que quieras lograr.</p>
      )}
    </Widget>
  );
}

function QuickWidget() {
  const run = useRunner();
  const [text, setText] = useState('');
  const save = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    const [first, ...rest] = value.split('\n');
    const short = first.length <= 80;
    const { ok } = await run(() => createRecord('note', { title: short ? first : '', content: short ? rest.join('\n') : value }), { success: 'Nota guardada en Notas' });
    if (ok) setText('');
  };
  return (
    <Widget id="quick" icon={StickyNote} title="Escribir rápido">
      <form className="org-stack" onSubmit={save}>
        <label htmlFor="dash-quick-note" className="sr-only">
          Nota rápida
        </label>
        <textarea id="dash-quick-note" className="field__control" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Una idea, una lista, algo que no quieres olvidar…" maxLength={20000} />
        <div className="org-toolbar">
          <Button type="submit" size="sm" disabled={!text.trim()}>
            Guardar nota
          </Button>
          <Button size="sm" variant="secondary" icon={Feather} to="/diario/nueva">
            Escribir en el diario
          </Button>
          <Button size="sm" variant="secondary" icon={HeartPulse} to="/emociones">
            ¿Cómo me siento?
          </Button>
        </div>
      </form>
    </Widget>
  );
}

const ACTIVITY_SOURCES = [
  ['note', 'Nota', '/notas/', (r) => r.title || excerpt(r.content, 50) || 'Nota sin título'],
  ['transaction', 'Movimiento', '/finanzas/movimientos', (r) => r.description || 'Movimiento'],
  ['event', 'Evento', '/calendario', (r) => r.title],
  ['task', 'Tarea', '/calendario/tareas', (r) => r.title],
  ['activity', 'Universidad', '/calendario/universidad', (r) => r.title],
  ['journalEntry', 'Diario', '/diario/', (r) => r.title || `Entrada del ${shortDate(r.eventDate)}`],
];

/** Lo último que cambió. El diario solo aparece si no está bloqueado; el diario emocional nunca muestra contenido aquí. */
function ActivityWidget() {
  const journalLocked = useLocked('journal').locked;
  const lists = {
    note: useKind('note'),
    transaction: useKind('transaction'),
    event: useKind('event'),
    task: useKind('task'),
    activity: useKind('activity'),
    journalEntry: useKind('journalEntry'),
  };
  const recent = useMemo(() => {
    const out = [];
    for (const [kind, label, path, title] of ACTIVITY_SOURCES) {
      if (kind === 'journalEntry' && journalLocked) continue;
      for (const record of lists[kind]) {
        if (record.trashedAt) continue;
        out.push({ id: record.id, label, title: title(record), at: record.updatedAt, to: path.endsWith('/') ? `${path}${record.id}` : path });
      }
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalLocked, ...Object.values(lists)]);
  return (
    <Widget id="activity" icon={History} title="Actividad reciente">
      {recent.length ? (
        <ul className="org-mini-list">
          {recent.map((r) => (
            <li key={r.id}>
              <Link to={r.to} className="org-link">
                <span className="org-subtle">{r.label}:</span> {r.title}
              </Link>
              <span className="org-subtle">{relativeTime(r.at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="org-muted">Cuando crees notas, tareas, eventos o movimientos, aparecerán aquí.</p>
      )}
    </Widget>
  );
}

const WIDGETS = {
  today: TodayWidget,
  university: UniversityWidget,
  tasks: TasksWidget,
  finance: FinanceWidget,
  payments: PaymentsWidget,
  goals: GoalsWidget,
  quick: QuickWidget,
  activity: ActivityWidget,
};

function CustomizeDialog({ open, onClose }) {
  const settings = useSettings('dashboardSettings');
  const run = useRunner();
  const widgets = settings.widgets;
  const save = (next) => run(() => saveSettings('dashboardSettings', { widgets: next }));
  const move = (index, step) => {
    const next = [...widgets];
    const [item] = next.splice(index, 1);
    next.splice(index + step, 0, item);
    save(next);
  };
  return (
    <Dialog open={open} onClose={onClose} title="Personalizar el panel" description="Elige qué ver y en qué orden. Se guarda al momento." size="md">
      <ul className="org-list">
        {widgets.map((w, index) => (
          <li key={w.id} className="org-row org-row--compact org-customize">
            <Switch label={DASHBOARD_WIDGETS.find((d) => d.id === w.id)?.label ?? w.id} checked={w.visible} onChange={(visible) => save(widgets.map((x) => (x.id === w.id ? { ...x, visible } : x)))} />
            <span className="org-row__end">
              <IconButton icon={ArrowUp} size="sm" label="Subir" disabled={index === 0} onClick={() => move(index, -1)} />
              <IconButton icon={ArrowDown} size="sm" label="Bajar" disabled={index === widgets.length - 1} onClick={() => move(index, 1)} />
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export default function DashboardPage() {
  const settings = useSettings('dashboardSettings');
  const navigate = useNavigate();
  const [customize, setCustomize] = useState(false);
  // En el panel, abrir un elemento lleva a su módulo (allí están sus formularios y detalles).
  const actions = useMemo(
    () => ({
      openItem: (item) => navigate(item.type === 'payment' ? '/finanzas/pagos' : item.type === 'task' ? '/calendario/tareas' : item.type === 'activity' || item.type === 'class' ? '/calendario/universidad' : '/calendario'),
      openTask: () => navigate('/calendario/tareas'),
      openEvent: () => navigate('/calendario'),
      openActivity: () => navigate('/calendario/universidad'),
      openSubject: () => navigate('/calendario/universidad'),
    }),
    [navigate],
  );
  useEffect(() => {
    document.title = 'Organización · Un año más contigo';
  }, []);
  const visible = settings.widgets.filter((w) => w.visible && WIDGETS[w.id]);
  return (
    <PlannerActions.Provider value={actions}>
      <ModuleLayout
        eyebrow="Tu día de un vistazo"
        title="Organización"
        description="Clases, tareas, pagos y dinero en una sola pantalla, con atajos para escribir."
        actions={
          <Button variant="secondary" icon={Settings2} onClick={() => setCustomize(true)}>
            Personalizar
          </Button>
        }
      >
        {visible.length ? (
          <div className="org-dashboard">
            {visible.map((w) => {
              const Component = WIDGETS[w.id];
              return <Component key={w.id} />;
            })}
          </div>
        ) : (
          <p className="org-muted">Todos los bloques están ocultos. Usa «Personalizar» para mostrar los que quieras.</p>
        )}
        <CustomizeDialog open={customize} onClose={() => setCustomize(false)} />
      </ModuleLayout>
    </PlannerActions.Provider>
  );
}
