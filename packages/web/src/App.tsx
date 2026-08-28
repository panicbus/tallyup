import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Onboarding } from './pages/Onboarding';
import { Settings } from './pages/Settings';

function Home() {
  return (
    <main>
      <h1>TallyUp</h1>
      <p>Scaffold in progress.</p>
    </main>
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
