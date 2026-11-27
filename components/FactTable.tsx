import type { ReactNode } from 'react';

export type FactRow = {
  key: string;
  name: ReactNode;
  thin: boolean; // too little to say much: shown faintly
  cells: (string | number)[];
};

/** Names down the side and numbers across, with thin evidence shown faintly. */
export default function FactTable({
  first,
  columns,
  rows,
}: {
  first: string;
  /** `wide`: left out on a phone, where the rest would not otherwise fit. */
  columns: { label: string; help?: string; wide?: boolean }[];
  rows: FactRow[];
}) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500">
            <th className="py-2 pr-2 text-left font-semibold">{first}</th>
            {columns.map((c) => (
              <th
                key={c.label}
                className={`px-1 py-2 text-right font-semibold sm:px-3 ${c.wide ? 'hidden sm:table-cell' : ''}`}
              >
                {c.help ? (
                  <abbr title={c.help} className="no-underline">
                    {c.label}
                  </abbr>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 tabular-nums">
          {rows.map((row) => (
            <tr
              key={row.key}
              data-thin={row.thin || undefined}
              className={row.thin ? 'text-zinc-500' : ''}
            >
              <th scope="row" className="py-2 pr-2 text-left font-semibold">
                {row.name}
              </th>
              {row.cells.map((cell, i) => (
                <td
                  key={columns[i].label}
                  className={`px-1 py-2 text-right sm:px-3 ${columns[i].wide ? 'hidden sm:table-cell' : ''}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
