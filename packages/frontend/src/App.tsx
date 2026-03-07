import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { SessionPage } from '@/components/SessionPage';
import { UploadPage } from '@/components/UploadPage';

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/session/:id" element={<SessionPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  </Router>
);

export default App;
