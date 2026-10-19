import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="page-card not-found-card">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="muted-copy">The page you requested does not exist.</p>
      <Link className="text-link" to="/">Return to overview</Link>
    </section>
  );
}
