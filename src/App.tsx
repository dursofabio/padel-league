import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { firebaseConfigured } from './firebase';
import { AuthProvider } from './hooks/auth';
import Admin from './pages/Admin';
import Disponibilita from './pages/Disponibilita';
import Gestore from './pages/Gestore';
import Home from './pages/Home';
import Invito from './pages/Invito';
import Login from './pages/Login';
import MiePartite from './pages/MiePartite';
import Organizzatore from './pages/Organizzatore';
import PartitaPage from './pages/Partita';
import Profilo from './pages/Profilo';
import TorneoPubblico from './pages/TorneoPubblico';

export default function App() {
  if (!firebaseConfigured) return <Setup />;
  return (
    <AuthProvider>
      {/* Hash routing: su GitHub Pages il refresh di una pagina interna non dà 404. */}
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="profilo" element={<Profilo />} />
            <Route path="gestore" element={<Gestore />} />
            <Route path="admin" element={<Admin />} />
            <Route path="invito/:tid/:token" element={<Invito />} />
            <Route path="t/:tid" element={<TorneoPubblico />} />
            <Route path="t/:tid/mie" element={<MiePartite />} />
            <Route path="t/:tid/disponibilita" element={<Disponibilita />} />
            <Route path="t/:tid/partita/:pid" element={<PartitaPage />} />
            <Route path="t/:tid/organizza" element={<Organizzatore />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

function Setup() {
  return (
    <main className="container">
      <h1>Configurazione mancante</h1>
      <p>
        Imposta le variabili <code>VITE_FIREBASE_*</code> (vedi <code>.env.example</code> e il README) e ricompila
        l&apos;app.
      </p>
    </main>
  );
}
