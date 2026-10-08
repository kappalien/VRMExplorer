// Test-only harness. Not imported by the production entry point.
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { VirtualList } from "../../src/components/VirtualList";
import "../../src/styles.css";
const all = Array.from({ length: 50000 }, (_, id) => ({
  id,
  name: `素材-${String(id).padStart(5, "0")}.png`,
}));
function Harness() {
  const [query, setQuery] = useState("");
  const [grid, setGrid] = useState(false);
  const items = useMemo(
    () => all.filter((v) => v.name.includes(query)),
    [query],
  );
  return (
    <div style={{ margin: 20, maxWidth: 900 }}>
      <h1>50,000 item virtual list verification</h1>
      <label>
        Search
        <input
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={grid}
          onChange={(e) => setGrid(e.target.checked)}
        />
        Grid
      </label>
      <VirtualList
        key={`${grid}:${query}`}
        items={items}
        itemKey={(v) => v.id}
        label="Assets"
        rowHeight={grid ? 148 : 40}
        minCellWidth={grid ? 120 : undefined}
        className={`file-list ${grid ? "thumbnails" : "list"}`}
        render={(v) => (
          <button className="file-row">
            <span className="filename">{v.name}</span>
          </button>
        )}
      />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
