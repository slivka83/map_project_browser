import type { ReactNode } from 'react';
import { badgeClass, badgeMuted } from './styles';

type BadgeVariant = 'default' | 'green' | 'red';

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: '',
  green: 'border-neon-green/50 text-neon-green',
  red: 'border-neon-red/50 text-neon-red',
};

export default function Badge({
  label,
  icon,
  variant = 'default',
}: {
  label: ReactNode;
  icon?: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span className={`${badgeClass} ${VARIANT_CLASS[variant]} ${variant === 'default' ? badgeMuted : ''}`}>
      {icon && <span className="flex h-3 w-3 items-center justify-center">{icon}</span>}
      {label}
    </span>
  );
}
