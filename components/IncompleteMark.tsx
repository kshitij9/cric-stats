const EXPLANATION =
  'This career may be incomplete: it begins in a period the data covers only in part.';

/** A dagger after a name whose career the data may only hold in part. */
export default function IncompleteMark({ show }: { show: boolean | undefined }) {
  if (!show) return null;
  return (
    <abbr title={EXPLANATION} aria-label={EXPLANATION} className="ml-1 text-amber-400 no-underline">
      †
    </abbr>
  );
}
