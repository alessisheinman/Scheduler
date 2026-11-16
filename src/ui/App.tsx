import { useCallback, useEffect, useState } from 'react';
import { BackupBar } from './BackupBar';
import { DogLightbox, DogRails, DogStrip, type DogPhoto } from './DogRails';
import { PeopleScreen } from './PeopleScreen';
import { useAppData } from './useAppData';
import { VenuesScreen } from './VenuesScreen';
import { defaultMonday, WeekScreen } from './WeekScreen';
import type { ISODate } from '../model/week';
import { buildImageModel } from '../model/image';
import { downloadScheduleImage } from './renderImage';

export type View = 'week' | 'payday' | 'people' | 'venues' | 'import';
const VIEWS: View[] = ['week', 'payday', 'people', 'venues', 'import'];
const parseHash = (): View => {
  const v = window.location.hash.replace(/^#\/?/, '') as View;
  return VIEWS.includes(v) ? v : 'week';
};

export function App() {
  const app = useAppData();
  const [view, setView] = useState<View>(parseHash);
  const [dog, setDog] = useState<DogPhoto | null>(null);
  const closeDog = useCallback(() => setDog(null), []);
  const [mondayPick, setMonday] = useState<ISODate | null>(null);
  const monday = mondayPick ?? defaultMonday(app);

  useEffect(() => {
    const onHash = () => setView(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (v: View) => { window.location.hash = `/${v}`; };
  const tab = (v: View, label: string) => (
    <a href={`#/${v}`} className={view === v ? 'on' : ''}>{label}</a>
  );

  return (
    <div className="app">
      <DogRails onOpen={setDog} />
      <header className="topbar">
        <a className="brand" href="#/week">Scheduler</a>
        <nav>
          {tab('week', 'Week')}
          {tab('payday', 'Payday')}
          {tab('people', 'People')}
          {tab('venues', 'Venues')}
        </nav>
      </header>
      <DogStrip onOpen={setDog} />
      {dog && <DogLightbox photo={dog} onClose={closeDog} />}
      <BackupBar app={app} />

      {!app.loaded ? <p className="empty">Loading…</p> : (
        <main>
          {view === 'people' && <PeopleScreen app={app} />}
          {view === 'venues' && <VenuesScreen app={app} />}
          {view === 'week' && (
            <WeekScreen app={app} monday={monday} setMonday={setMonday}
              onPayday={() => go('payday')} onImport={() => go('import')} onSaveImage={() => void downloadScheduleImage(buildImageModel(app.data, monday), `schedule-${monday}.png`)} />
          )}
          {(view === 'payday' || view === 'import') && (
            <div className="card"><p className="empty">Coming next.</p></div>
          )}
        </main>
      )}
    </div>
  );
}
