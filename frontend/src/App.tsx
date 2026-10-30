import { Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import AppLayout from "./layouts/AppLayout";
import Overview from "./pages/Overview";
import Analyze from "./pages/Analyze";
import Report from "./pages/Report";
import Compare from "./pages/Compare";
import Saved from "./pages/Saved";
import Checkout from "./pages/Checkout";
import Budget from "./pages/Budget";
import History from "./pages/History";
import Settings from "./pages/Settings";
import AnalysisLoader from "./pages/AnalysisLoader";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Overview />} />
        <Route path="analyze" element={<Analyze />} />
        <Route path="report" element={<Report />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="saved" element={<Saved />} />
        <Route path="compare" element={<Compare />} />
        <Route path="budget" element={<Budget />} />
        <Route path="history" element={<History />} />
        <Route path="analysis/:id" element={<AnalysisLoader />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
