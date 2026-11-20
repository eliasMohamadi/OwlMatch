import { INTEREST_LIST, type InterestId } from '@shared/interests';
import type { DiscoverFilters } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/primitives';
import { Sheet } from '../../components/ui/Sheet';

type Options<T extends string> = { value: T; label: string }[];

const CAMPUS: Options<NonNullable<DiscoverFilters['campus']>> = [
  { value: 'both', label: 'Both' },
  { value: 'kennesaw', label: 'Kennesaw' },
  { value: 'marietta', label: 'Marietta' },
];
const WHEN: Options<NonNullable<DiscoverFilters['when']>> = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'week', label: 'Next 7 days' },
];
const KIND: Options<NonNullable<DiscoverFilters['kind']>> = [
  { value: 'all', label: 'Everything' },
  { value: 'event', label: 'One-time events' },
  { value: 'ongoing', label: 'Ongoing' },
];

export function countActiveFilters(filters: DiscoverFilters): number {
  return [filters.campus, filters.categories?.length, filters.when && filters.when !== 'any', filters.kind && filters.kind !== 'all'].filter(Boolean).length;
}

export function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  filters: DiscoverFilters;
  onChange: (filters: DiscoverFilters) => void;
}) {
  const categories = filters.categories ?? [];
  const toggleCategory = (id: InterestId) =>
    onChange({ ...filters, categories: categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id] });

  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <div className="space-y-6">
        <Group label="Campus" options={CAMPUS} value={filters.campus} onSelect={(campus) => onChange({ ...filters, campus })} />
        <Group label="When" options={WHEN} value={filters.when ?? 'any'} onSelect={(when) => onChange({ ...filters, when })} />
        <Group label="Type" options={KIND} value={filters.kind ?? 'all'} onSelect={(kind) => onChange({ ...filters, kind })} />
        <fieldset>
          <legend className="mb-2.5 text-sm font-semibold text-ink">Categories</legend>
          <div className="flex flex-wrap gap-2">
            {INTEREST_LIST.map((interest) => (
              <Chip key={interest.id} selected={categories.includes(interest.id)} onClick={() => toggleCategory(interest.id)}>
                {interest.shortLabel}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={() => onChange({})}>
            Reset
          </Button>
          <Button onClick={onClose}>Show results</Button>
        </div>
      </div>
    </Sheet>
  );
}

function Group<T extends string>({ label, options, value, onSelect }: { label: string; options: Options<T>; value: T | undefined; onSelect: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option.value} selected={value === option.value} onClick={() => onSelect(option.value)}>
            {option.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
