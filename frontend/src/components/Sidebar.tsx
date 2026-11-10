import { useState } from "react";

type SidebarProps = {
  hasUser: boolean;
  page: string;
  onNavigate: (page: string) => void;
};

const pageGroups = [
  { label: "YOUR PRESENCE", pages: ["Overview", "Shadow profile"] },
  {
    label: "VOICE & CONVERSATION",
    pages: ["Voice identity", "Conversations", "Live meeting"],
  },
  { label: "CONTEXT & SETTINGS", pages: ["Memories", "Connections"] },
];
const pageIndexes = new Map(
  pageGroups
    .flatMap((group) => group.pages)
    .map((item, index) => [item, index + 1]),
);

export default function Sidebar({ hasUser, page, onNavigate }: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="workspace-sidebar">
      <a
        className="workspace-brand"
        href="#workspace-top"
        onClick={() => onNavigate("Overview")}
      >
        <span className="wordmark-mark" aria-hidden="true">
          <i />
          <i />
        </span>
        <span>shadow clone</span>
      </a>
      <p className="sidebar-caption">PERSONAL VOICE STUDIO</p>
      {hasUser && (
        <>
          <button
            type="button"
            className="workspace-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>{page}</span>
            <span className="workspace-menu-chevron" aria-hidden="true">
              {menuOpen ? "−" : "+"}
            </span>
          </button>
          <nav
            className={menuOpen ? "is-open" : ""}
            id="workspace-navigation"
            aria-label="Workspace navigation"
          >
            {pageGroups.map((group) => (
              <div className="workspace-nav-group" key={group.label}>
                <span className="workspace-nav-label">{group.label}</span>
                {group.pages.map((item) => (
                  <button
                    className={page === item ? "selected" : ""}
                    aria-current={page === item ? "page" : undefined}
                    onClick={() => {
                      onNavigate(item);
                      setMenuOpen(false);
                    }}
                    key={item}
                  >
                    <span className="workspace-nav-index" aria-hidden="true">
                      {String(pageIndexes.get(item)).padStart(2, "0")}
                    </span>
                    <span>{item}</span>
                    {page === item && (
                      <span
                        className="workspace-nav-current"
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </>
      )}
      <footer className="workspace-sidebar-footer">
        <span className="sidebar-footer-mark" aria-hidden="true">
          <i />
          <i />
        </span>
        <span>PRIVATE BY DESIGN</span>
        <span>Your voice. Your permission.</span>
      </footer>
    </aside>
  );
}
