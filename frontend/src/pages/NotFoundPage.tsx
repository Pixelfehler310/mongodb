import { Link } from "react-router-dom";

export const NotFoundPage = () => {
  return (
    <section className="card">
      <h2>Seite nicht gefunden</h2>
      <p>Diese Route existiert nicht.</p>
      <Link to="/">Zurueck zur Startseite</Link>
    </section>
  );
};
