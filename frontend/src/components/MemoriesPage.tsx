type Memory = {
  id: string;
  category: string;
  content: string;
};

type MemoriesPageProps = {
  memories: Memory[];
  busy: boolean;
  onCreate: (
    fields: Record<string, FormDataEntryValue>,
    form: HTMLFormElement,
  ) => void;
  onDelete: (id: string) => void;
};

export default function MemoriesPage({
  memories,
  busy,
  onCreate,
  onDelete,
}: MemoriesPageProps) {
  return (
    <section className="memories-page">
      <header className="workspace-page-intro">
        <p className="eyebrow">A PRIVATE, EDITABLE ARCHIVE</p>
        <h1>Your knowledge.</h1>
        <p>
          Keep confirmed facts and preferences. Add or remove them whenever you
          choose.
        </p>
      </header>
      <div className="memories-layout">
        <form
          className="memory-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            onCreate(Object.fromEntries(new FormData(form)), form);
          }}
        >
          <div className="memory-form-heading">
            <span>01</span>
            <div>
              <small>ADD TO YOUR CONTEXT</small>
              <h2>A detail worth remembering.</h2>
            </div>
          </div>
          <label>
            Memory
            <textarea
              name="content"
              required
              maxLength={4000}
              placeholder="A preference, fact, or decision you want your Shadow to know."
            />
          </label>
          <label>
            Category
            <select name="category">
              {["personal_fact", "preference", "knowledge", "decision"].map(
                (category) => (
                  <option key={category} value={category}>
                    {category.replaceAll("_", " ")}
                  </option>
                ),
              )}
            </select>
          </label>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Saving…" : "Save memory"} <span aria-hidden="true">↗</span>
          </button>
          <p className="memory-form-note">
            You can review or remove anything here at any time.
          </p>
        </form>
        <section className="memory-archive" aria-label="Saved memories">
          <header className="memory-archive-heading">
            <div>
              <small>YOUR ARCHIVE</small>
              <h2>Confirmed context</h2>
            </div>
            <span className="memory-archive-count">
              {String(memories.length).padStart(2, "0")}
            </span>
          </header>
          {memories.length === 0 ? (
            <div className="memory-empty-state">
              <span aria-hidden="true">—</span>
              <p>No memories added yet.</p>
              <small>
                Your archive will appear here when you save a memory.
              </small>
            </div>
          ) : (
            <div className="memory-archive-list">
              {memories.map((memory, index) => (
                <article className="memory-card" key={memory.id}>
                  <div className="memory-card-meta">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <small>
                      {memory.category.replaceAll("_", " ")} · CONFIRMED
                    </small>
                  </div>
                  <p>{memory.content}</p>
                  <button
                    className="memory-delete"
                    disabled={busy}
                    onClick={() => onDelete(memory.id)}
                  >
                    Remove <span aria-hidden="true">×</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
