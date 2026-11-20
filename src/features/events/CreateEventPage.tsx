import { ImagePlus, Loader2, Send, Wand2, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateNewEvent, type FieldErrors } from '@shared/eventValidation';
import { INTEREST_LIST, type InterestId } from '@shared/interests';
import { campusDateKey } from '@shared/time';
import type { NewEventInput } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { Chip, Toggle } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import { ApiError, api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useCreateEvent, useCurrentStudent } from '../../lib/queries';
import { useSession } from '../../lib/session';
import { EventCover } from './EventCover';
import { ACCEPTED_IMAGE_TYPES, ImageError, prepareCoverImage } from './imageUpload';

const MAX_CATEGORIES = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

type Draft = Omit<NewEventInput, 'organizerId' | 'capacity'> & { capacity: string };

const tomorrow = () => campusDateKey(new Date(Date.now() + DAY_MS));

const EMPTY_DRAFT = (): Draft => ({
  title: '',
  description: '',
  categories: [],
  campus: 'marietta',
  venue: '',
  address: '',
  date: tomorrow(),
  startTime: '19:00',
  endTime: '21:00',
  capacity: '',
  visibility: 'public',
  groupSize: 'small',
  energy: 'relaxed',
  beginnerFriendly: true,
  organizationName: '',
  coverImageUrl: null,
});

/** Prefills the demo storyline's event (Scene 1). Clearly a helper, not hidden data. */
const DEMO_EXAMPLE = (): Draft => ({
  ...EMPTY_DRAFT(),
  title: 'Casual Game Night: Smash, Mario Kart & Indie Games',
  description:
    'Low-key game night in the Student Center game room. We will run casual Smash and Mario Kart rounds and try a couple of indie games some of us built in class. No skill needed, just come hang out and meet other people who like games and coding. Controllers provided, snacks welcome.',
  categories: ['gaming', 'social', 'tech'],
  venue: 'Student Center Game Room',
  address: 'Student Center Game Room, Marietta Campus',
  startTime: '19:00',
  endTime: '22:00',
  capacity: '16',
});

export function CreateEventPage() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { studentId } = useSession();
  const { data: student } = useCurrentStudent();
  const create = useCreateEvent();
  const navigate = useNavigate();
  const toast = useToast();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const toggleCategory = (id: InterestId) => {
    const has = draft.categories.includes(id);
    if (!has && draft.categories.length >= MAX_CATEGORIES) return toast(`Pick up to ${MAX_CATEGORIES} categories`, 'info');
    set('categories', has ? draft.categories.filter((c) => c !== id) : [...draft.categories, id]);
  };

  const onImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await prepareCoverImage(file);
      const { url } = await api.uploadImage(dataUrl);
      set('coverImageUrl', url);
    } catch (error) {
      toast(error instanceof ImageError || error instanceof ApiError ? error.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input: NewEventInput = { ...draft, organizerId: studentId, capacity: draft.capacity ? Number(draft.capacity) : null };
    const result = validateNewEvent(input, new Date());
    if (!result.ok) {
      setErrors(result.errors);
      toast('Please fix the highlighted fields', 'error');
      return;
    }
    create.mutate(input, {
      onSuccess: (created) => {
        toast('Published! Other students can discover it now.');
        navigate(`/events/${created.id}`);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 422) setErrors(error.details as FieldErrors);
        toast(error.message, 'error');
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">Host something</p>
          <h1 className="text-[1.85rem] leading-none font-extrabold tracking-[-0.04em] text-ink">Create an event</h1>
        </div>
        <Button type="button" variant="outline" size="sm" icon={<Wand2 size={16} />} onClick={() => { setDraft(DEMO_EXAMPLE()); setErrors({}); }}>
          Demo example
        </Button>
      </div>

      <div className="space-y-5">
        <Section title="Cover image">
          <div className="relative overflow-hidden rounded-2xl border border-line">
            <EventCover imageUrl={draft.coverImageUrl} category={draft.categories[0] ?? 'social'} title={draft.title || 'New event'} className="h-44" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/10">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading} icon={uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}>
                {draft.coverImageUrl ? 'Change image' : 'Upload image'}
              </Button>
              {draft.coverImageUrl && (
                <Button type="button" variant="outline" size="sm" aria-label="Remove image" onClick={() => set('coverImageUrl', null)}>
                  <X size={16} />
                </Button>
              )}
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="sr-only"
            aria-label="Cover image file"
            data-testid="cover-input"
            onChange={(e) => void onImage(e.target.files?.[0])}
          />
          <p className="mt-2 text-xs text-muted">JPEG, PNG or WebP. Without one we generate a cover from your category.</p>
        </Section>

        <Section title="The basics">
          <Field label="Event name" error={errors.title} htmlFor="title">
            <input id="title" value={draft.title} onChange={(e) => set('title', e.target.value)} className={inputClass(errors.title)} placeholder="Pickup basketball, study group, game night…" />
          </Field>
          <Field label="Description" error={errors.description} htmlFor="description">
            <textarea id="description" rows={4} value={draft.description} onChange={(e) => set('description', e.target.value)} className={cn(inputClass(errors.description), 'h-auto py-3')} placeholder="What will people do? Who is it for? What should they bring?" />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">Categories (up to {MAX_CATEGORIES})</legend>
            <div className="flex flex-wrap gap-2">
              {INTEREST_LIST.map((i) => (
                <Chip key={i.id} selected={draft.categories.includes(i.id)} onClick={() => toggleCategory(i.id)}>
                  {i.shortLabel}
                </Chip>
              ))}
            </div>
            {errors.categories && <p className="mt-1.5 text-sm text-danger">{errors.categories}</p>}
          </fieldset>
        </Section>

        <Section title="When & where">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">Campus</legend>
            <div className="flex gap-2">
              {(['marietta', 'kennesaw'] as const).map((campus) => (
                <Chip key={campus} selected={draft.campus === campus} onClick={() => set('campus', campus)}>
                  {campus === 'marietta' ? 'Marietta' : 'Kennesaw'}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Field label="Venue" error={errors.venue} htmlFor="venue">
            <input id="venue" value={draft.venue} onChange={(e) => set('venue', e.target.value)} className={inputClass(errors.venue)} placeholder="Student Center Game Room" />
          </Field>
          <Field label="Exact location (room, entrance)" htmlFor="address" hint="Hidden until you approve someone, if you choose 'Approval required'.">
            <input id="address" value={draft.address} onChange={(e) => set('address', e.target.value)} className={inputClass()} placeholder="Room 210, side entrance" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Date" error={errors.date} htmlFor="date">
              <input id="date" type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} className={inputClass(errors.date)} />
            </Field>
            <Field label="Starts" error={errors.startTime} htmlFor="start">
              <input id="start" type="time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} className={inputClass(errors.startTime)} />
            </Field>
            <Field label="Ends" error={errors.endTime} htmlFor="end">
              <input id="end" type="time" value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} className={inputClass(errors.endTime)} />
            </Field>
          </div>
          <p className="text-xs text-muted">Times are campus time (Eastern).</p>
        </Section>

        <Section title="Vibe & access">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChipRow label="Group size" value={draft.groupSize} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} onChange={(v) => set('groupSize', v)} />
            <ChipRow label="Energy" value={draft.energy} options={[['relaxed', 'Relaxed'], ['high', 'High-energy']]} onChange={(v) => set('energy', v)} />
          </div>
          <Toggle checked={draft.beginnerFriendly} onChange={(v) => set('beginnerFriendly', v)} label="Beginner friendly" description="Newcomers welcome, no experience needed." />
          <Field label="Max attendees (optional)" error={errors.capacity} htmlFor="capacity">
            <input id="capacity" inputMode="numeric" value={draft.capacity} onChange={(e) => set('capacity', e.target.value.replace(/\D/g, ''))} className={inputClass(errors.capacity)} placeholder="No limit" />
          </Field>
          <ChipRow
            label="Who can join"
            value={draft.visibility}
            options={[['public', 'Public'], ['approval', 'Approval required'], ['invite', 'Invite only (link)']]}
            onChange={(v) => set('visibility', v)}
          />
        </Section>

        <Section title="Organizer">
          <p className="text-sm text-muted">
            Posting as <span className="font-semibold text-ink">{student?.name}</span> (demo account).
          </p>
          <Field label="Student organization (optional)" htmlFor="org" hint="Shown as a claim. Organization affiliation is not verified in demo mode.">
            <input id="org" value={draft.organizationName} onChange={(e) => set('organizationName', e.target.value)} className={inputClass()} placeholder="e.g. Game Dev Society" />
          </Field>
        </Section>
      </div>

      <div className="sticky bottom-20 z-10 mt-6 md:bottom-4">
        <Button type="submit" size="lg" block loading={create.isPending} icon={<Send size={18} />}>
          Publish event
        </Button>
      </div>
    </form>
  );
}

const inputClass = (error?: string) =>
  cn('h-12 w-full rounded-2xl border-2 bg-white px-4 text-[16px] text-ink placeholder:text-neutral focus:outline-none', error ? 'border-danger' : 'border-line focus:border-ink');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5">
      <h2 className="font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, error, hint, htmlFor, children }: { label: string; error?: string; hint?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-sm text-danger" role="alert">{error}</p> : hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function ChipRow<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, text]) => (
          <Chip key={v} selected={value === v} onClick={() => onChange(v)}>
            {text}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
