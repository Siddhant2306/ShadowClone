type SidebarProps = {
  hasUser: boolean;
  page: string;
  onNavigate: (page: string) => void;
};

const pages = [
  "Overview",
  "Shadow profile",
  "Memories",
  "Voice identity",
  "Conversations",
  "Live meeting",
  "Connections",
];

export default function Sidebar({ hasUser, page, onNavigate }: SidebarProps) {
  return (
    <aside>
      <h2>◈ Shadow Clone</h2>
      <small>YOUR VOICE. YOUR BOUNDARIES.</small>
      {hasUser && (
        <nav>
          {pages.map((item) => (
            <button
              className={page === item ? "selected" : ""}
              onClick={() => onNavigate(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </nav>
      )}
      <footer>
        Personal representation,
        <br />
        with you in control.
      </footer>
    </aside>
  );
}
