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
    <>
      <p className="eyebrow">A PRIVATE, EDITABLE ARCHIVE</p>
      <h1>Your knowledge.</h1>
      <p>
        Keep confirmed facts and preferences. Add or remove them whenever you
        choose.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          onCreate(Object.fromEntries(new FormData(form)), form);
        }}
      >
        <label>
          Memory
          <textarea name="content" required maxLength={4000} />
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
          {busy ? "Saving…" : "Save memory"}
        </button>
      </form>
      {memories.map((memory) => (
        <article className="dashboard-card memory-card" key={memory.id}>
          <small>{memory.category.replaceAll("_", " ")} · CONFIRMED</small>
          <p>{memory.content}</p>
          <button
            className="text-link danger-link"
            disabled={busy}
            onClick={() => onDelete(memory.id)}
          >
            Delete memory
          </button>
        </article>
      ))}
    </>
  );
}
