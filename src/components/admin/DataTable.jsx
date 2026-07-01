import { useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconArrowRight, IconSearch } from '../../icons';
import { ShimmerTableRow } from '../ui/Shimmer';

// Minimal generic table. Server-side pagination — parent owns page state.
// `columns`: [{ key, header, render?(row), width? }]
export default function DataTable({
  columns,
  rows,
  loading,
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onRowClick,
  onSearch,
  searchPlaceholder = 'Search…',
  filters,
  emptyMessage = 'Nothing here yet.',
}) {
  const [search, setSearch] = useState('');

  // Hold onSearch in a ref so debounce only fires when the user actually
  // types. Parents typically pass an inline `(v) => { setQ(v); setPage(1); }`
  // whose reference changes every render — depending on it here caused the
  // effect to re-run on every parent update, and 300ms later fire
  // onSearch('') which resets the page to 1. That produced the bug where
  // clicking "next page" briefly advanced then snapped back to page 1.
  const onSearchRef = useRef(onSearch);
  useEffect(() => { onSearchRef.current = onSearch; });

  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    if (!onSearchRef.current) return;
    const id = setTimeout(() => onSearchRef.current(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="admin-table-wrap">
      {(onSearch || filters) && (
        <div className="admin-table-toolbar">
          {onSearch && (
            <label className="admin-search">
              <IconSearch size="sm" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
          )}
          {filters}
        </div>
      )}

      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <ShimmerTableRow key={'shimmer-' + i} cols={columns.length} />
            ))}
            {!loading && (!rows || rows.length === 0) && (
              <tr><td colSpan={columns.length} className="admin-td-empty">{emptyMessage}</td></tr>
            )}
            {!loading && rows && rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'admin-tr-clickable' : ''}
              >
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="admin-pagination">
          <span className="muted-text" style={{ fontSize: '.8125rem' }}>
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="row gap-2">
            <button
              type="button"
              className="btn btn-outline"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              style={{ padding: '.3rem .6rem' }}
            ><IconArrowLeft size="sm" /></button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              style={{ padding: '.3rem .6rem' }}
            ><IconArrowRight size="sm" /></button>
          </div>
        </div>
      )}

      <style>{`
        .admin-table-wrap {
          background: var(--card); border: 1px solid var(--border); border-radius: .5rem;
          overflow: hidden;
        }
        .admin-table-toolbar {
          display: flex; gap: .75rem; align-items: center; flex-wrap: wrap;
          padding: .75rem; border-bottom: 1px solid var(--border);
        }
        .admin-search {
          display: flex; align-items: center; gap: .5rem;
          padding: .375rem .625rem; border: 1px solid var(--border);
          border-radius: .375rem; background: var(--background);
          min-width: 240px; flex: 1;
        }
        .admin-search input {
          flex: 1; background: transparent; border: 0; outline: 0;
          font-size: .875rem; color: var(--foreground);
        }
        .admin-table-scroll { overflow-x: auto; }
        .admin-table { width: 100%; border-collapse: collapse; font-size: .8125rem; }
        .admin-table th {
          text-align: left; padding: .625rem .875rem;
          background: var(--muted, #f5f5f4); color: var(--muted-foreground);
          font-weight: 600; font-size: .75rem; text-transform: uppercase;
          letter-spacing: .04em; border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .admin-table td {
          padding: .75rem .875rem; border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .admin-table tr:last-child td { border-bottom: 0; }
        .admin-tr-clickable { cursor: pointer; transition: background .12s; }
        .admin-tr-clickable:hover { background: var(--muted, #fafaf9); }
        .admin-td-empty {
          padding: 2rem 1rem; text-align: center;
          color: var(--muted-foreground); font-size: .875rem;
        }
        .admin-pagination {
          display: flex; justify-content: space-between; align-items: center;
          padding: .625rem .875rem; border-top: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}
