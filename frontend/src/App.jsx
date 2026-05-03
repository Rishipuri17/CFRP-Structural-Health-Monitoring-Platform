/**
 * App.jsx — Root router and layout.
 * Framer Motion AnimatePresence wraps route changes.
 */
import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import Navbar           from "./components/Navbar.jsx";
import Landing          from "./pages/Landing.jsx";
import CompositeSelector from "./pages/CompositeSelector.jsx";
import SignalExplorer   from "./pages/SignalExplorer.jsx";
import DamageClassifier from "./pages/DamageClassifier.jsx";
import RULPredictor     from "./pages/RULPredictor.jsx";
import SHAPInsights       from "./pages/SHAPInsights.jsx";
import TrainingPipeline  from "./pages/TrainingPipeline.jsx";

/** Animated route wrapper */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"          element={<Landing />} />
        <Route path="/select"    element={<CompositeSelector />} />
        <Route path="/signals"   element={<SignalExplorer />} />
        <Route path="/classify"  element={<DamageClassifier />} />
        <Route path="/rul"       element={<RULPredictor />} />
        <Route path="/shap"      element={<SHAPInsights />} />
        <Route path="/train"     element={<TrainingPipeline />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gunmetal text-text-primary">
        <Navbar />
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  );
}
