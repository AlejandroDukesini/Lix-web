import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { CalendarClock, ChartColumn, Gauge, LayoutDashboard, PiggyBank, Plus, ReceiptText, Tags, Wallet } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { ModuleLayout } from '../shared/ui.jsx';
import { FinanceActions } from './FinanceContext.js';
import { TransactionForm } from './TransactionForm.jsx';
import { Overview } from './views/Overview.jsx';
import { Transactions } from './views/Transactions.jsx';
import { Accounts } from './views/Accounts.jsx';
import { Budgets } from './views/Budgets.jsx';
import { Goals } from './views/Goals.jsx';
import { Scheduled } from './views/Scheduled.jsx';
import { Reports } from './views/Reports.jsx';
import { Categories } from './views/Categories.jsx';
import '../shared/organizer.css';
import './finance.css';

const TABS = [
  { to: '/finanzas', end: true, label: 'Resumen', icon: LayoutDashboard },
  { to: '/finanzas/movimientos', label: 'Movimientos', icon: ReceiptText },
  { to: '/finanzas/cuentas', label: 'Cuentas', icon: Wallet },
  { to: '/finanzas/presupuestos', label: 'Presupuestos', icon: Gauge },
  { to: '/finanzas/metas', label: 'Metas', icon: PiggyBank },
  { to: '/finanzas/pagos', label: 'Pagos', icon: CalendarClock },
  { to: '/finanzas/informes', label: 'Informes', icon: ChartColumn },
  { to: '/finanzas/categorias', label: 'Categorías', icon: Tags },
];

export default function FinancePage() {
  const [form, setForm] = useState(null); // { initial, quick }
  const location = useLocation();
  const navigate = useNavigate();
  const openTransaction = useCallback((initial, options = {}) => setForm({ initial, quick: Boolean(options.quick) }), []);
  const actions = useMemo(() => ({ openTransaction }), [openTransaction]);

  // Accesos directos desde otras pantallas (Inicio de organización): #/finanzas?nuevo=gasto
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('nuevo');
    if (!action) return;
    openTransaction(null, { quick: action === 'gasto' });
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate, openTransaction]);

  useEffect(() => {
    document.title = 'Finanzas · Un año más contigo';
  }, []);

  return (
    <FinanceActions.Provider value={actions}>
      <ModuleLayout
        eyebrow="Organización"
        title="Finanzas"
        description="Cuentas, gastos, presupuestos y metas. Todos los totales salen de tus movimientos reales."
        tabs={TABS}
        actions={
          <Button icon={Plus} onClick={() => openTransaction(null, { quick: true })} className="org-noprint">
            Gasto rápido
          </Button>
        }
      >
        <Routes>
          <Route index element={<Overview onNewTransaction={() => openTransaction(null)} onQuickExpense={() => openTransaction(null, { quick: true })} />} />
          <Route path="movimientos" element={<Transactions />} />
          <Route path="cuentas" element={<Accounts />} />
          <Route path="presupuestos" element={<Budgets />} />
          <Route path="metas" element={<Goals />} />
          <Route path="pagos" element={<Scheduled />} />
          <Route path="informes" element={<Reports />} />
          <Route path="categorias" element={<Categories />} />
          <Route path="*" element={<Navigate to="/finanzas" replace />} />
        </Routes>
        <TransactionForm open={Boolean(form)} initial={form?.initial} quick={form?.quick} onClose={() => setForm(null)} />
      </ModuleLayout>
    </FinanceActions.Provider>
  );
}
