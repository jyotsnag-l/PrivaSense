import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { LandingPage } from "./components/LandingPage";
import { ElderlyPath } from "./components/elderly/ElderlyPath";
import { CaregiverPath } from "./components/caregiver/CaregiverPath";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/elderly" element={<ElderlyPath />} />
        <Route path="/caregiver" element={<CaregiverPath />} />
      </Routes>
    </Router>
  );
}
