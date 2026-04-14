import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useAnalyticsQuery } from "../hooks/queries";

export const AnalyticsPage = () => {
  const analyticsQuery = useAnalyticsQuery();

  if (analyticsQuery.isLoading) {
    return <p>Lade Analytics...</p>;
  }

  if (analyticsQuery.error) {
    return <p className="error">{(analyticsQuery.error as Error).message}</p>;
  }

  if (!analyticsQuery.data) {
    return <p>Keine Daten vorhanden.</p>;
  }

  const analytics = analyticsQuery.data;

  return (
    <section className="analytics-layout">
      <div className="stats-row">
        <article className="card stat-card">
          <h3>Produkte gesamt</h3>
          <p>{analytics.summary.total_products}</p>
        </article>
        <article className="card stat-card">
          <h3>Kategorien</h3>
          <p>{analytics.summary.total_categories}</p>
        </article>
        <article className="card stat-card">
          <h3>Produkte mit Reviews</h3>
          <p>{analytics.summary.products_with_reviews}</p>
        </article>
        <article className="card stat-card">
          <h3>Durchschnittspreis</h3>
          <p>{analytics.summary.overall_avg_price.toFixed(2)} EUR</p>
        </article>
      </div>

      <div className="charts-row">
        <article className="card chart-card">
          <h3>Produkte je Kategorie</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.categories}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#00ed64" />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="card chart-card">
          <h3>Durchschnittspreis je Kategorie</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics.categories}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="avg_price" stroke="#108f50" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </article>
      </div>

      <article className="card">
        <h3>Top Produkte nach Bewertung</h3>
        <table className="top-products">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kategorie</th>
              <th>Rating</th>
              <th>Reviews</th>
              <th>Preis</th>
            </tr>
          </thead>
          <tbody>
            {analytics.top_products.map((item) => (
              <tr key={item._id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.avg_rating.toFixed(2)}</td>
                <td>{item.review_count}</td>
                <td>{item.price.toFixed(2)} EUR</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
};
