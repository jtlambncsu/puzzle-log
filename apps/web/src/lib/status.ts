import {
  CircleCheckBigIcon,
  HeartIcon,
  PackageIcon,
  TimerIcon,
  type LucideIcon,
} from 'lucide-react';
import type { PuzzleStatus } from '@puzzle-log/shared';

export const STATUS_INFO: Record<
  PuzzleStatus,
  /** `shortLabel` is for tight spots, like the status picker on a phone. */
  { label: string; shortLabel?: string; description: string; icon: LucideIcon }
> = {
  done: { label: 'Done', description: "You've finished it", icon: CircleCheckBigIcon },
  in_progress: {
    label: 'In progress',
    shortLabel: 'Started',
    description: "You're working on it",
    icon: TimerIcon,
  },
  owned: { label: 'Owned', description: "You have it but haven't done it yet", icon: PackageIcon },
  wishlist: { label: 'Wishlist', description: 'You want it', icon: HeartIcon },
};
