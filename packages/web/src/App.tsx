import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';

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
        <Route path="/dashboard/:slug" element={<Dashboard />} />
        <Route path="/checkin/:slug" element={<CheckIn />} />
      </Routes>
    </BrowserRouter>
  );
}
