import type { ReactNode } from "react";

// Small inline icons, drawn here so the module ships no icon dependency.

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

type Props = { size?: number };

export const PlayIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M6.5 4.2 L15.5 10 L6.5 15.8 Z" fill="currentColor" />
  </Icon>
);
export const PauseIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M7 4.5 V15.5 M13 4.5 V15.5" strokeWidth="2.6" />
  </Icon>
);
export const NextIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M5 4.5 L12.5 10 L5 15.5 Z" fill="currentColor" />
    <path d="M15 4.5 V15.5" strokeWidth="2.2" />
  </Icon>
);
export const BackIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M15 4.5 L7.5 10 L15 15.5 Z" fill="currentColor" />
    <path d="M5 4.5 V15.5" strokeWidth="2.2" />
  </Icon>
);
export const RestartIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M4.5 10 a5.5 5.5 0 1 0 1.8 -4.1" />
    <path d="M4.2 3.6 V6.6 H7.2" />
  </Icon>
);
export const CloseIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M5 5 L15 15 M15 5 L5 15" />
  </Icon>
);
export const HouseIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M3.5 9.5 L10 4 L16.5 9.5" />
    <path d="M5.5 8.5 V16 H14.5 V8.5" />
    <path d="M8.6 16 V12 H11.4 V16" />
  </Icon>
);
export const DocIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M5.5 3 H11.5 L15 6.5 V17 H5.5 Z" />
    <path d="M11.5 3 V6.5 H15 M8 10 H12.5 M8 13 H12.5" />
  </Icon>
);
export const ArrowIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M4 10 H16 M11.5 5.5 L16 10 L11.5 14.5" />
  </Icon>
);
export const FlowIcon = ({ size }: Props) => (
  <Icon size={size}>
    <circle cx="4.5" cy="10" r="2" />
    <rect x="9" y="7.2" width="6.5" height="5.6" rx="1.4" />
    <path d="M6.5 10 H9" />
  </Icon>
);
export const TrashIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M4.5 6 H15.5 M8 6 V4 H12 V6 M6 6 L6.8 16.5 H13.2 L14 6" />
  </Icon>
);
export const PlusIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M10 4.5 V15.5 M4.5 10 H15.5" />
  </Icon>
);
export const ChatIcon = ({ size }: Props) => (
  <Icon size={size}>
    <path d="M4 5 H16 V13 H9.5 L6 16 V13 H4 Z" />
  </Icon>
);
