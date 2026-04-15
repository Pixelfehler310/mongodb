import { NavLink, Route, Routes } from "react-router-dom";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CatalogPage } from "./pages/CatalogPage";
import { HealthPage } from "./pages/HealthPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";

export const App = () => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="badge">MongoDB Atlas Showcase</p>
          <h1>Flexible Product Intelligence</h1>
        </div>
        <nav>
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>Katalog</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => (isActive ? "active" : "")}>Analytics</NavLink>
          <NavLink to="/health" className={({ isActive }) => (isActive ? "active" : "")}>DB Health</NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
};
