// Tams the bull, Deskmate's mascot. Shared by every module.
export function TamsMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Tams the bull">
      <path d="M15 23C6 21 3 11 8 4c2 9 7 12 14 13z" fill="#F4E9D2" />
      <path d="M49 23c9-2 12-12 7-19-2 9-7 12-14 13z" fill="#F4E9D2" />
      <ellipse cx="10.5" cy="30" rx="6.5" ry="3.6" transform="rotate(-22 10.5 30)" fill="#C8401F" />
      <ellipse cx="53.5" cy="30" rx="6.5" ry="3.6" transform="rotate(22 53.5 30)" fill="#C8401F" />
      <path d="M15 26c0-13 34-13 34 0l-1 17c-1 13-31 13-32 0z" fill="#FF5A3C" />
      <ellipse cx="32" cy="46" rx="13.5" ry="9.5" fill="#FFDCCF" />
      <ellipse cx="26.5" cy="46" rx="2.2" ry="2.8" fill="#1D1A16" />
      <ellipse cx="37.5" cy="46" rx="2.2" ry="2.8" fill="#1D1A16" />
      <circle cx="24" cy="31" r="2.8" fill="#1D1A16" />
      <circle cx="40" cy="31" r="2.8" fill="#1D1A16" />
    </svg>
  );
}
