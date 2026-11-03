import { ChoiceCards, FieldLabel } from './FormModal';
import { POSITION_OPTIONS, type OperatorPosition } from '@/types/api';

/** Optional parish leadership position picker - clicking the selected card clears it. */
function PositionCards({ value, onChange }: { value: OperatorPosition | null; onChange: (position: OperatorPosition | null) => void }) {
  return (
    <div className="field">
      <FieldLabel hint="Optional">Leadership position</FieldLabel>
      <ChoiceCards
        label="Leadership position"
        columns={3}
        options={POSITION_OPTIONS}
        selected={value ? [value] : []}
        onToggle={(v) => onChange(v === value ? null : (v as OperatorPosition))}
      />
    </div>
  );
}

export default PositionCards;
