import { CircleCheckBigIcon, HeartIcon, PackageIcon, type LucideIcon } from 'lucide-react';
import type { PuzzleStatus } from '@puzzle-log/shared';

export const STATUS_INFO: Record<
  PuzzleStatus,
  { label: string; description: string; icon: LucideIcon }
> = {
  done: { label: 'Done', description: "You've finished it", icon: CircleCheckBigIcon },
  owned: { label: 'Owned', description: "You have it but haven't done it yet", icon: PackageIcon },
  wishlist: { label: 'Wishlist', description: 'You want it', icon: HeartIcon },
};
