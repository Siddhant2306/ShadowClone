type WorkspaceHeaderProps = {
  hasUser: boolean;
  page: string;
  onSignOut: () => void;
};

const pageDescriptions: Record<string, string> = {
  Overview: "Your voice workspace",
  "Shadow profile": "The details that shape your responses",
  "Voice identity": "Voice enrollment and controls",
  Conversations: "Private, approval-led simulations",
  "Live meeting": "Disclosed live audio session",
  Memories: "Your editable context archive",
  Connections: "Provider and platform availability",
};

export default function WorkspaceHeader({
  hasUser,
  page,
  onSignOut,
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header" id="workspace-top">
      <div className="workspace-header-context">
        <span className="workspace-header-kicker">
          WORKSPACE <span aria-hidden="true">/</span> {page.toUpperCase()}
        </span>
        <span className="workspace-header-subtitle">
          {pageDescriptions[page] ?? "Your voice workspace"}
        </span>
      </div>
      {hasUser && (
        <div className="workspace-header-actions">
          <span className="workspace-privacy-label">
            <i aria-hidden="true" />
            PRIVATE SPACE
          </span>
          <span className="workspace-header-divider" aria-hidden="true" />
          <button
            className="workspace-signout"
            onClick={onSignOut}
            aria-label="Sign out of Shadow Clone"
          >
            Sign out <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
    </header>
  );
}
