import type { RuleProfile } from "../types/settings";

interface ProfileSelectorProps {
  profiles: RuleProfile[];
  activeProfileId: string;
  onSelect: (profileId: string) => void;
}

export function ProfileSelector({ profiles, activeProfileId, onSelect }: ProfileSelectorProps) {
  return (
    <div className="profile-list">
      {profiles.map((profile) => (
        <button className={`profile-option ${profile.id === activeProfileId ? "active" : ""}`} type="button" key={profile.id} onClick={() => onSelect(profile.id)}>
          <strong>{profile.name}</strong>
          {profile.lockedDefault && <span className="pill info" style={{ marginLeft: 8 }}>встроенный</span>}
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {profile.description}
          </p>
          {profile.source && <p className="muted" style={{ margin: "4px 0 0" }}>{profile.source.title}</p>}
        </button>
      ))}
    </div>
  );
}
