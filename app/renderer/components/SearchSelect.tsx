import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterSearchOptions, prioritizeSearchOptions, type SearchSelectOption } from '../lib/search-options';

const NO_SUGGESTIONS: readonly string[] = [];

export function SearchSelect({ id, value, options, suggestedValues = NO_SUGGESTIONS, onChange, ariaLabel, placeholder = 'Gõ để tìm kiếm…' }: {
  /** Id của ô nhập, để `<label htmlFor>` bên ngoài gắn được vào. */
  id?: string;
  value: string;
  options: readonly SearchSelectOption[];
  suggestedValues?: readonly string[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const generatedId = useId().replace(/:/g, '');
  const listId = `search-select-${generatedId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dirtyQuery, setDirtyQuery] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const preparedOptions = useMemo(() => prioritizeSearchOptions(options, suggestedValues), [options, suggestedValues]);
  const selected = preparedOptions.find((option) => option.value === value);
  const filtered = useMemo(() => filterSearchOptions(preparedOptions, dirtyQuery ? query : ''), [dirtyQuery, preparedOptions, query]);
  const safeActiveIndex = filtered.length ? Math.min(activeIndex, filtered.length - 1) : -1;

  // Giữ lựa chọn bằng bàn phím trong vùng nhìn thấy khi danh sách dài.
  useEffect(() => {
    if (!open || safeActiveIndex < 0) return;
    document.getElementById(`${listId}-${safeActiveIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [listId, open, safeActiveIndex]);

  function showOptions() {
    if (!open) {
      setOpen(true);
      setDirtyQuery(false);
      setQuery('');
      setActiveIndex(Math.max(0, preparedOptions.findIndex((option) => option.value === value)));
    }
  }

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setDirtyQuery(false);
    setQuery('');
    inputRef.current?.focus();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setDirtyQuery(false);
      setQuery('');
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      showOptions();
      if (!filtered.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (Math.max(0, Math.min(index, filtered.length - 1)) + step + filtered.length) % filtered.length);
      return;
    }
    if (event.key === 'Enter' && open && safeActiveIndex >= 0) {
      event.preventDefault();
      event.stopPropagation();
      choose(filtered[safeActiveIndex].value);
    }
  }

  return (
    <div className="search-select" onBlur={(event) => {
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
      setOpen(false); setDirtyQuery(false); setQuery('');
    }}>
      <input ref={inputRef} id={id} type="search" role="combobox" autoComplete="off" spellCheck={false}
        aria-label={ariaLabel} aria-expanded={open} aria-controls={open ? listId : undefined} aria-autocomplete="list"
        aria-activedescendant={open && safeActiveIndex >= 0 ? `${listId}-${safeActiveIndex}` : undefined}
        placeholder={placeholder} value={dirtyQuery ? query : selected?.label ?? ''}
        // Nhận focus (kể cả Tab đi ngang qua) chỉ bôi đen chữ để gõ đè; danh sách
        // mở khi bấm chuột, gõ chữ hoặc ↓/↑ (gồm Alt+↓). Trước đây Tab qua bộ lọc
        // Báo cáo là danh sách bung ra che các nút Xuất bên dưới (U31).
        onFocus={(event) => { event.currentTarget.select(); }}
        onClick={(event) => { showOptions(); event.currentTarget.select(); }}
        onChange={(event) => { setQuery(event.target.value); setDirtyQuery(true); setOpen(true); setActiveIndex(0); }}
        onKeyDown={onInputKeyDown} />
      {open && (
        <div id={listId} className="search-select-menu" role="listbox" aria-label={ariaLabel}>
          {filtered.length ? filtered.map((option, index) => (
            <button id={`${listId}-${index}`} key={option.value} type="button" role="option" tabIndex={-1}
              aria-selected={option.value === value}
              className={`search-select-option${index === safeActiveIndex ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}`}
              onMouseEnter={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option.value)}>
              <span>{option.label}</span>
              {option.suggested && <small>Gợi ý</small>}
            </button>
          )) : <p className="search-select-empty">Không tìm thấy xét nghiệm phù hợp</p>}
        </div>
      )}
    </div>
  );
}
