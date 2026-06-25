interface RuleToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function RuleToggle({ label, description, checked, onChange }: RuleToggleProps) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <span className="muted" style={{ display: "block" }}>{description}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
