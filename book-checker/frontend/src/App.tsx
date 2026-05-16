import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lists from './pages/Lists';
import Archive from './pages/Archive';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lists" element={<Lists />} />
        <Route path="/archive" element={<Archive />} />
      </Routes>
    </Router>
  );
}

export default App;
