import type { RuleProfile } from "../types/settings";
import { isMainProfile, isProfileDeletable } from "../services/settings/profileManager";

interface ProfileSelectorProps {
  profiles: RuleProfile[];
  activeProfileId: string;
  onSelect: (profileId: string) => void;
  onClone: (profileId: string) => void;
  onDelete: (profileId: string) => void;
}

function profileDate(profile: RuleProfile): string | null {
  const raw = profile.updatedAt ?? profile.createdAt;
  return raw ? new Date(raw).toLocaleString("ru-RU") : null;
}

function ProfileCard({
  profile,
  activeProfileId,
  onSelect,
  onClone,
  onDelete
}: {
  profile: RuleProfile;
  activeProfileId: string;
  onSelect: (profileId: string) => void;
  onClone: (profileId: string) => void;
  onDelete: (profileId: string) => void;
}) {
  const main = isMainProfile(profile);
  const selected = profile.id === activeProfileId;
  const changedAt = profileDate(profile);
  return (
    <div className={`profile-option ${selected ? "active" : ""}`}>
      <strong>{profile.name}</strong>
      {main && <span className="pill success" style={{ marginLeft: 8 }}>основной</span>}
      {(main || profile.isLocked || profile.lockedDefault) && <span className="pill info" style={{ marginLeft: 8 }}>защищён</span>}
      {!main && profile.profileOrigin === "user" && <span className="pill info" style={{ marginLeft: 8 }}>мой профиль</span>}
      <p className="muted" style={{ margin: "6px 0 0" }}>{profile.description}</p>
      {profile.source && <p className="muted" style={{ margin: "4px 0 0" }}>{profile.source.title}</p>}
      {changedAt && <p className="muted" style={{ margin: "4px 0 0" }}>Изменён: {changedAt}</p>}
      <p className="muted" style={{ margin: "4px 0 0" }}>
        Поля: левое {profile.pageLayout.leftMarginMm} мм, правое {profile.pageLayout.rightMarginMm} мм, верхнее {profile.pageLayout.topMarginMm} мм, нижнее {profile.pageLayout.bottomMarginMm} мм
      </p>
      <div className="toolbar" style={{ marginTop: 10 }}>
        <button className={`button ${selected ? "primary" : ""}`} type="button" onClick={() => onSelect(profile.id)}>
          {selected ? "Выбран" : "Выбрать"}
        </button>
        {main ? (
          <button className="button" type="button" onClick={() => onClone(profile.id)}>Создать копию</button>
        ) : (
          <>
            <button className="button" type="button" onClick={() => onSelect(profile.id)}>Редактировать</button>
            {isProfileDeletable(profile) && (
              <button className="button danger" type="button" onClick={() => onDelete(profile.id)}>Удалить</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ProfileSelector({ profiles, activeProfileId, onSelect, onClone, onDelete }: ProfileSelectorProps) {
  const mainProfile = profiles.find(isMainProfile) ?? profiles[0];
  const userProfiles = profiles.filter((profile) => profile.id !== mainProfile?.id);
  return (
    <div className="profile-list">
      {mainProfile && (
        <section>
          <h3>Основной профиль</h3>
          <ProfileCard profile={mainProfile} activeProfileId={activeProfileId} onSelect={onSelect} onClone={onClone} onDelete={onDelete} />
        </section>
      )}
      <section>
        <h3>Мои профили</h3>
        {userProfiles.length === 0 ? (
          <p className="muted">Пользовательских профилей пока нет. Создайте копию основного профиля, чтобы настроить требования под себя.</p>
        ) : (
          userProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} activeProfileId={activeProfileId} onSelect={onSelect} onClone={onClone} onDelete={onDelete} />)
        )}
      </section>
    </div>
  );
}
