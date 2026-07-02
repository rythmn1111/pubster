import { redirect } from 'next/navigation';

/** Root route — the dashboard opens on reservations (auth is enforced there). */
export default function HomePage() {
  redirect('/reservations');
}
