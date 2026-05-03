import { NavLink, Route, Routes } from "react-router-dom";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CatalogPage } from "./pages/CatalogPage";
import { HealthPage } from "./pages/HealthPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { useDatabaseStore, type DatabaseMode } from "./store/database";

export const App = () => {
  const dbMode = useDatabaseStore((state) => state.mode);
  const setDbMode = useDatabaseStore((state) => state.setMode);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="badge">MongoDB Atlas Showcase</p>
          <h1>Flexible Product Intelligence</h1>
        </div>
        <div className="header-actions">
          <nav>
            <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>Katalog</NavLink>
            <NavLink to="/analytics" className={({ isActive }) => (isActive ? "active" : "")}>Analytics</NavLink>
            <NavLink to="/health" className={({ isActive }) => (isActive ? "active" : "")}>DB Health</NavLink>
          </nav>

          <label className="db-toggle">
            Datenbank
            <select value={dbMode} onChange={(event) => setDbMode(event.target.value as DatabaseMode)}>
              <option value="mongo">MongoDB</option>
              <option value="postgres">PostgreSQL</option>
            </select>
          </label>
        </div>
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
