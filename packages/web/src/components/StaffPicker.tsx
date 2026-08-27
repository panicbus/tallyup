import type { StaffMember } from '../lib/api';

interface StaffPickerProps {
  staff: StaffMember[];
  selectedId: string;
  onChange: (staffId: string) => void;
}

export function StaffPicker({ staff, selectedId, onChange }: StaffPickerProps) {
  return (
    <label>
      Confirming as:{' '}
      <select value={selectedId} onChange={(e) => onChange(e.target.value)}>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.email}
          </option>
        ))}
      </select>
    </label>
  );
}
