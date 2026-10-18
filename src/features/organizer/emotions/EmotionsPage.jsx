import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ChartColumn, HeartPulse, History as HistoryIcon, Leaf, Settings2 } from 'lucide-react';
import { ModuleLayout } from '../shared/ui.jsx';
import { LockButton, PrivacyGate } from '../shared/PrivacyGate.jsx';
import { Today } from './views/Today.jsx';
import { History } from './views/History.jsx';
import { Charts } from './views/Charts.jsx';
import { Wellbeing } from './views/Wellbeing.jsx';
import { EmotionSettings } from './views/EmotionSettings.jsx';
import '../shared/organizer.css';
import '../planner/planner.css';
import './emotions.css';

const TABS = [
  { to: '/emociones', end: true, label: 'Registrar', icon: HeartPulse },
  { to: '/emociones/historial', label: 'Historial', icon: HistoryIcon },
  { to: '/emociones/graficos', label: 'Gráficos', icon: ChartColumn },
  { to: '/emociones/bienestar', label: 'Bienestar', icon: Leaf },
  { to: '/emociones/ajustes', label: 'Ajustes', icon: Settings2 },
];

export default function EmotionsPage() {
  useEffect(() => {
    document.title = 'Diario emocional · Un año más contigo';
  }, []);
  return (
    <ModuleLayout
      eyebrow="Organización"
      title="Diario emocional"
      description="Nombrar lo que sientes y verlo con el tiempo, sin juicios ni diagnósticos."
      tabs={TABS}
      actions={<LockButton module="emotions" />}
    >
      <Routes>
        {/* Los ejercicios no muestran datos privados: se pueden usar sin desbloquear. */}
        <Route path="bienestar" element={<Wellbeing />} />
        <Route
          path="*"
          element={
            <PrivacyGate module="emotions" title="El diario emocional">
              <Routes>
                <Route index element={<Today />} />
                <Route path="historial" element={<History />} />
                <Route path="graficos" element={<Charts />} />
                <Route path="ajustes" element={<EmotionSettings />} />
                <Route path="*" element={<Navigate to="/emociones" replace />} />
              </Routes>
            </PrivacyGate>
          }
        />
      </Routes>
    </ModuleLayout>
  );
}
