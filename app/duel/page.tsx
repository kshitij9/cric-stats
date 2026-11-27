import { redirect } from 'next/navigation';

// the two-player duel is now part of Compare
export default function DuelPage() {
  redirect('/compare');
}
