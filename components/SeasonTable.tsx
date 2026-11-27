/** The seasons behind the charts, as numbers. */
export default function SeasonTable<T extends { year: number }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { label: string; show: (row: T) => string | number }[];
}) {
  return (
    <details className="text-sm lg:col-span-2">
      <summary className="cursor-pointer text-sky-400">Show the seasons as a table</summary>
      <div className="relative overflow-x-auto">
        <table className="mt-3 w-full max-w-lg tabular-nums">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-500">
              <th className="py-1.5 text-left">Year</th>
              {columns.map((c) => (
                <th key={c.label} className="py-1.5 pl-3 text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-b border-zinc-900">
                <td className="py-1.5">{row.year}</td>
                {columns.map((c) => (
                  <td key={c.label} className="py-1.5 pl-3 text-right">
                    {c.show(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
