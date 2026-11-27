'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';

type Props<Chosen, Found extends Chosen> = {
  label?: string;
  selected: Chosen | null;
  onSelect: (item: Found | null) => void; // null: the choice was cleared
  endpoint: string; // returns Found[]; the typed text is added as ?q=
  itemKey: (item: Found) => string;
  itemText: (item: Chosen) => string; // shown in the box once chosen
  renderItem: (item: Found) => ReactNode;
  placeholder?: string;
  clearable?: boolean;
};

/** A text box that searches as you type and only accepts a result from the list. */
export default function SearchBox<Chosen, Found extends Chosen>({
  label,
  selected,
  onSelect,
  endpoint,
  itemKey,
  itemText,
  renderItem,
  placeholder,
  clearable,
}: Props<Chosen, Found>) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState<string | null>(null); // null: showing the choice
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ url: string; items: Found[] | null } | null>(null);

  const text = typed?.trim() ?? '';
  const url =
    text.length >= 2
      ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}q=${encodeURIComponent(text)}`
      : null;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        setResult({ url, items: (await response.json()) as Found[] });
      } catch {
        if (!controller.signal.aborted) setResult({ url, items: null });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url]);

  const current = result && result.url === url ? result : null;
  const items = current?.items ?? [];
  const open = typed !== null;
  const status = !url
    ? 'Type at least 2 letters'
    : !current
      ? 'Searching…'
      : current.items === null
        ? 'Search failed. Try again.'
        : items.length === 0
          ? 'No matches'
          : null;

  const choose = (item: Found) => {
    onSelect(item);
    setTyped(null);
    // leave the box, so the next click selects the text and typing replaces it
    input.current?.blur();
  };

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="block text-xs text-zinc-500 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && items[active] ? `${id}-${active}` : undefined}
          aria-label={label ? undefined : placeholder}
          autoComplete="off"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-8 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
          placeholder={placeholder}
          value={typed ?? (selected ? itemText(selected) : '')}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            setTyped(e.target.value);
            setActive(0);
          }}
          onBlur={() => {
            if (clearable && typed !== null && typed.trim() === '') onSelect(null);
            setTyped(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              if (items.length) setActive((a) => (a + step + items.length) % items.length);
            } else if (e.key === 'Enter' && open && items[active]) {
              e.preventDefault();
              choose(items[active]);
            } else if (e.key === 'Escape') {
              setTyped(null);
            }
          }}
        />
        {clearable && selected && !open && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-red-400"
            aria-label={`Clear ${label ?? 'choice'}`}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 w-full min-w-[260px] max-h-80 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        >
          {status ? (
            <li className="px-3 py-2 text-xs text-zinc-500">{status}</li>
          ) : (
            items.map((item, i) => (
              <li
                key={itemKey(item)}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                // keep focus in the box, so blur does not close the list first
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-sky-500/15' : ''}`}
              >
                {renderItem(item)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
