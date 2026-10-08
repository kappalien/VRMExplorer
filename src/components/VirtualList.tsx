import { useEffect, useRef, useState, type ReactNode } from "react";
export function visibleRange(
  count: number,
  columns: number,
  rowHeight: number,
  top: number,
  height: number,
  overscan = 3,
) {
  const rows = Math.ceil(count / columns);
  const first = Math.max(
    0,
    Math.min(rows, Math.floor(top / rowHeight) - overscan),
  );
  const last = Math.min(rows, Math.ceil((top + height) / rowHeight) + overscan);
  return {
    start: first * columns,
    end: Math.min(count, last * columns),
    height: rows * rowHeight,
  };
}
export function VirtualList<T>({
  items,
  itemKey,
  render,
  rowHeight,
  minCellWidth,
  label,
  className = "",
}: {
  items: T[];
  itemKey: (item: T) => string | number;
  render: (item: T) => ReactNode;
  rowHeight: number;
  minCellWidth?: number;
  label: string;
  className?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ width: 600, height: 400, top: 0 });
  const columns = minCellWidth
    ? Math.max(1, Math.floor(geometry.width / minCellWidth))
    : 1;
  const range = visibleRange(
    items.length,
    columns,
    rowHeight,
    geometry.top,
    geometry.height,
  );
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setGeometry((g) => ({
        ...g,
        width: element.clientWidth,
        height: element.clientHeight,
      })),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={viewport}
      className={`virtual-viewport ${className}`}
      role="list"
      aria-label={label}
      tabIndex={0}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        setGeometry((g) => ({ ...g, top }));
      }}
      onKeyDown={(e) => {
        if (
          !items.length ||
          ![
            "ArrowDown",
            "ArrowUp",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
          ].includes(e.key)
        )
          return;
        const cell = (e.target as HTMLElement).closest<HTMLElement>(
          "[data-virtual-index]",
        );
        const current = cell ? Number(cell.dataset.virtualIndex) : 0;
        const target = Math.max(
          0,
          Math.min(
            items.length - 1,
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : current +
                  (e.key === "ArrowDown"
                    ? columns
                    : e.key === "ArrowUp"
                      ? -columns
                      : e.key === "ArrowLeft"
                        ? -1
                        : 1),
          ),
        );
        e.preventDefault();
        const element = viewport.current!;
        const rowTop = Math.floor(target / columns) * rowHeight;
        if (rowTop < element.scrollTop) element.scrollTop = rowTop;
        else if (rowTop + rowHeight > element.scrollTop + element.clientHeight)
          element.scrollTop = rowTop + rowHeight - element.clientHeight;
        setGeometry((g) => ({ ...g, top: element.scrollTop }));
        requestAnimationFrame(() =>
          element
            .querySelector<HTMLElement>(
              `[data-virtual-index="${target}"] button:not([disabled])`,
            )
            ?.focus(),
        );
      }}
    >
      <div className="virtual-spacer" style={{ height: range.height }}>
        {items.slice(range.start, range.end).map((item, offset) => {
          const index = range.start + offset;
          return (
            <div
              key={itemKey(item)}
              data-virtual-index={index}
              role="listitem"
              aria-posinset={index + 1}
              aria-setsize={items.length}
              className="virtual-cell"
              style={{
                top: Math.floor(index / columns) * rowHeight,
                height: rowHeight,
                left: `${((index % columns) * 100) / columns}%`,
                width: `${100 / columns}%`,
              }}
            >
              {render(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
