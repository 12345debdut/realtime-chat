/** Format a timestamp into a relative time label for chat lists. */
export function formatTime(ts?: number | null): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    const hours = date.getHours();
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hours % 12 || 12}:${mins} ${hours >= 12 ? 'PM' : 'AM'}`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
