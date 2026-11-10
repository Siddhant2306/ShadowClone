type WorkspaceHeaderProps = {
  hasUser: boolean;
  onSignOut: () => void;
};

export default function WorkspaceHeader({
  hasUser,
  onSignOut,
}: WorkspaceHeaderProps) {
  return (
    <header>
      <span>PERSONAL VOICE WORKSPACE</span>
      {hasUser && <button onClick={onSignOut}>Sign out</button>}
    </header>
  );
}
