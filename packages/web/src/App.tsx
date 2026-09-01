import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Onboarding } from './pages/Onboarding';
import { Settings } from './pages/Settings';

function Home() {
  return (
    <div className="page">
      <div className="page-content" style={{ alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
        <img src="/logo.svg" alt="" width={72} height={72} />
        <h1 style={{ marginTop: 4 }}>TallyUp</h1>
        <p className="text-muted">Digital punch cards for shops that don't want an app.</p>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: 8 }}>
          Staff sign in
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard/:slug" element={<Dashboard />} />
        <Route path="/dashboard/:slug/settings" element={<Settings />} />
        <Route path="/checkin/:slug" element={<CheckIn />} />
      </Routes>
    </BrowserRouter>
  );
}
