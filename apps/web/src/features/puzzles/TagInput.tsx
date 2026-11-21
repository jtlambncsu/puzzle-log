import { useState } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { MAX_TAGS, uniqueTags } from '@puzzle-log/shared';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { normalize, sameTag } from '@/lib/search';

interface TagInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  /** Tags already used on other puzzles, offered as one-tap choices. */
  suggestions?: string[];
  disabled?: boolean;
}

/**
 * Chips for the chosen tags, plus a text box: Enter or comma adds a tag, Backspace in an
 * empty box removes the last one. Existing tags are suggested so spellings stay consistent
 * ("Star Wars", not "starwars"), which is what makes filtering by tag useful.
 */
export function TagInput({ id, value, onChange, suggestions = [], disabled }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const full = value.length >= MAX_TAGS;

  function add(tag: string) {
    const trimmed = tag.trim().slice(0, 30);
    if (trimmed && !full) onChange(uniqueTags([...value, trimmed]));
    setDraft('');
  }

  const query = normalize(draft.trim());
  const available = suggestions
    .filter((tag) => !value.some((chosen) => sameTag(chosen, tag)))
    // Match the start of any word: "s" suggests "Star Wars", not "Movies".
    .filter(
      (tag) =>
        !query ||
        normalize(tag)
          .split(/\s+/)
          .some((word) => word.startsWith(query)),
    )
    .slice(0, 8);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen tags">
          {value.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary" className="h-7 gap-1 pr-1 text-sm">
                {tag}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50"
                  onClick={() => onChange(value.filter((t) => t !== tag))}
                  disabled={disabled}
                  aria-label={`Remove tag ${tag}`}
                >
                  <XIcon className="size-3.5" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        disabled={disabled || full}
        placeholder={full ? `Up to ${MAX_TAGS} tags` : 'Add a tag, e.g. Star Wars'}
        autoComplete="off"
        enterKeyHint="done"
        onChange={(event) => {
          // A comma finishes a tag, which is quick on a phone keyboard.
          const text = event.target.value;
          if (text.includes(',')) {
            text.split(',').slice(0, -1).forEach(add);
            setDraft(text.split(',').at(-1) ?? '');
          } else {
            setDraft(text);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault(); // add the tag, don't submit the form
            add(draft);
          } else if (event.key === 'Backspace' && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
      />
      {available.length > 0 && !disabled && !full && (
        <div className="flex flex-wrap gap-1.5" aria-label="Suggested tags">
          {available.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <PlusIcon className="size-3.5" aria-hidden />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
