'use client';

import type { ReactNode } from 'react';
import { useMasters, values as masterValues } from '@/lib/hooks';
import { BioWriter } from './BioWriter';
import type { OwnProfile } from '@/lib/types';
import {
  CREATED_FOR,
  DIET,
  FAMILY_TYPE,
  FAMILY_VALUES,
  GENDER,
  HABIT,
  HEIGHT_OPTIONS,
  MANGLIK,
  MARITAL_STATUS,
} from '@/lib/labels';

export type Values = Record<string, string | number | null | undefined>;
export type Setter = (field: string, value: string | number | null) => void;

interface FieldProps {
  name: string;
  label: string;
  values: Values;
  set: Setter;
  required?: boolean;
}

function Select({ name, label, values, set, required, options, disabled, hint }: FieldProps & { options: { value: string | number; label: string }[]; disabled?: boolean; hint?: string }) {
  return (
    <label className="label">
      <span>
        {label}
        {required && <span className="text-maroon"> *</span>}
      </span>
      <select
        className="input"
        required={required}
        disabled={disabled}
        value={values[name] ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          const num = options.length > 0 && typeof options[0].value === 'number';
          set(name, raw === '' ? null : num ? Number(raw) : raw);
        }}
      >
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs font-normal text-ink-muted">{hint}</span>}
    </label>
  );
}

function Text({ name, label, values, set, required, type = 'text', placeholder, max }: FieldProps & { type?: string; placeholder?: string; max?: string }) {
  return (
    <label className="label">
      <span>
        {label}
        {required && <span className="text-maroon"> *</span>}
      </span>
      <input
        className="input"
        type={type}
        required={required}
        placeholder={placeholder}
        max={max}
        value={(values[name] as string | number | undefined) ?? ''}
        onChange={(e) => set(name, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      />
    </label>
  );
}

const fromMap = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));
const fromList = (l: string[]) => l.map((v) => ({ value: v, label: v }));
const COUNT_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: i, label: String(i) }));

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

/** Step 1 — basic details. `locked` disables fields that can't change after submission. */
export function BasicFields({ values, set, locked }: { values: Values; set: Setter; locked?: boolean }) {
  const masters = useMasters();
  const religion = values.religion as string | undefined;
  return (
    <Grid>
      <Select name="createdFor" label="This profile is for" values={values} set={set} required options={fromMap(CREATED_FOR)} />
      <Select name="gender" label="Gender" values={values} set={set} required options={fromMap(GENDER)} disabled={locked} hint={locked ? 'Contact support to change this.' : undefined} />
      <Text name="firstName" label="First name" values={values} set={set} required />
      <Text name="lastName" label="Last name" values={values} set={set} required />
      <Text name="dateOfBirth" label="Date of birth" type="date" values={values} set={set} required max={new Date().toISOString().slice(0, 10)} />
      <Select name="heightCm" label="Height" values={values} set={set} required options={HEIGHT_OPTIONS} />
      <Select name="maritalStatus" label="Marital status" values={values} set={set} required options={fromMap(MARITAL_STATUS)} />
      <Select name="motherTongue" label="Mother tongue" values={values} set={set} required options={fromList(masterValues(masters, 'MOTHER_TONGUE'))} />
      <Select
        name="religion"
        label="Religion"
        values={values}
        set={(f, v) => {
          set(f, v);
          set('community', null);
        }}
        required
        options={fromList(masterValues(masters, 'RELIGION'))}
      />
      <Select name="community" label="Community / caste" values={values} set={set} required options={fromList(masterValues(masters, 'COMMUNITY', religion ?? '__none__'))} hint={religion ? undefined : 'Choose a religion first.'} />
      <Text name="subCaste" label="Sub-caste (optional)" values={values} set={set} />
      <Select name="manglik" label="Manglik (optional)" values={values} set={set} options={fromMap(MANGLIK)} />
    </Grid>
  );
}

export function LocationFields({ values, set }: { values: Values; set: Setter }) {
  const masters = useMasters();
  return (
    <Grid>
      <Text name="country" label="Country" values={values} set={set} required />
      <Select name="state" label="State" values={values} set={set} required options={fromList(masterValues(masters, 'STATE'))} />
      <Text name="city" label="City" values={values} set={set} required placeholder="e.g. Pune" />
      <Text name="citizenship" label="Citizenship" values={values} set={set} />
    </Grid>
  );
}

export function CareerFields({ values, set }: { values: Values; set: Setter }) {
  const masters = useMasters();
  return (
    <Grid>
      <Select name="education" label="Highest education" values={values} set={set} required options={fromList(masterValues(masters, 'EDUCATION'))} />
      <Text name="college" label="College / university" values={values} set={set} />
      <Select name="profession" label="Profession" values={values} set={set} required options={fromList(masterValues(masters, 'PROFESSION'))} />
      <Text name="company" label="Company / organisation" values={values} set={set} />
      <Select name="annualIncome" label="Annual income" values={values} set={set} required options={fromList(masterValues(masters, 'INCOME'))} />
    </Grid>
  );
}

export function FamilyFields({ values, set }: { values: Values; set: Setter }) {
  return (
    <Grid>
      <Select name="familyType" label="Family type" values={values} set={set} required options={fromMap(FAMILY_TYPE)} />
      <Select name="familyValues" label="Family values" values={values} set={set} required options={fromMap(FAMILY_VALUES)} />
      <Text name="fatherOccupation" label="Father’s occupation" values={values} set={set} />
      <Text name="motherOccupation" label="Mother’s occupation" values={values} set={set} />
      <Select name="brothers" label="Brothers" values={values} set={set} options={COUNT_OPTIONS} />
      <Select name="sisters" label="Sisters" values={values} set={set} options={COUNT_OPTIONS} />
      <Text name="nativePlace" label="Native place" values={values} set={set} />
    </Grid>
  );
}

export function LifestyleFields({ values, set }: { values: Values; set: Setter }) {
  return (
    <Grid>
      <Select name="diet" label="Diet" values={values} set={set} required options={fromMap(DIET)} />
      <Select name="smoking" label="Smoking" values={values} set={set} options={fromMap(HABIT)} />
      <Select name="drinking" label="Drinking" values={values} set={set} options={fromMap(HABIT)} />
    </Grid>
  );
}

export const MIN_ABOUT = 50;

export function AboutFields({ values, set }: { values: Values; set: Setter }) {
  const text = (values.aboutMe as string) ?? '';
  return (
    <div className="flex flex-col gap-3">
      <label className="label">
        <span>
          About {values.createdFor && values.createdFor !== 'SELF' ? 'them' : 'yourself'}
          <span className="text-maroon"> *</span>
        </span>
        <textarea
          className="input min-h-[180px] leading-relaxed"
          required
          minLength={MIN_ABOUT}
          maxLength={2000}
          value={text}
          onChange={(e) => set('aboutMe', e.target.value)}
          placeholder="Talk about personality, interests, family, and what you hope for in a life partner."
        />
        <span className={`text-xs font-normal ${text.trim().length < MIN_ABOUT ? 'text-ink-muted' : 'text-success'}`}>
          {text.trim().length} / {MIN_ABOUT} characters minimum. Please don’t include phone numbers or emails.
        </span>
      </label>
      <BioWriter onDraft={(draft) => set('aboutMe', draft)} />
    </div>
  );
}

export const PROFILE_STEPS = [
  { title: 'Basic details', Fields: BasicFields },
  { title: 'Location', Fields: LocationFields },
  { title: 'Education & career', Fields: CareerFields },
  { title: 'Family', Fields: FamilyFields },
  { title: 'Lifestyle', Fields: LifestyleFields },
  { title: 'About', Fields: AboutFields },
] as const;

/** Field names each section owns, to send only that section's values. */
export const STEP_FIELDS: string[][] = [
  ['createdFor', 'gender', 'firstName', 'lastName', 'dateOfBirth', 'heightCm', 'maritalStatus', 'motherTongue', 'religion', 'community', 'subCaste', 'manglik'],
  ['country', 'state', 'city', 'citizenship'],
  ['education', 'college', 'profession', 'company', 'annualIncome'],
  ['familyType', 'familyValues', 'fatherOccupation', 'motherOccupation', 'brothers', 'sisters', 'nativePlace'],
  ['diet', 'smoking', 'drinking'],
  ['aboutMe'],
];

/** Build the PATCH body for a section: drop empty values, and dates go as YYYY-MM-DD. */
export function sectionBody(values: Values, fields: string[], locked = false) {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    if (locked && (f === 'gender' || f === 'dateOfBirth')) continue;
    const v = values[f];
    if (v === null || v === undefined || v === '') continue;
    body[f] = f === 'dateOfBirth' ? String(v).slice(0, 10) : v;
  }
  return body;
}

/** Form values from the API profile (dates trimmed to YYYY-MM-DD for date inputs). */
export function toValues(p: OwnProfile): Values {
  const v: Values = {};
  for (const [k, val] of Object.entries(p)) {
    if (typeof val === 'string' || typeof val === 'number' || val === null) v[k] = val;
  }
  if (typeof p.dateOfBirth === 'string') v.dateOfBirth = p.dateOfBirth.slice(0, 10);
  return v;
}
