import { TEAM_COLORS } from '@/lib/colors';
import type { Side } from '@/lib/rivalry-types';

/** A side's colour, shown beside its name. */
export default function Swatch({ side }: { side: Side }) {
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block size-3 shrink-0 rounded-sm"
      style={{ background: TEAM_COLORS[side] }}
    />
  );
}
