// Outline-Icon-Set (stroke-basiert, currentColor). Keine Fills, keine KI-Klischees.

interface IconProps {
  className?: string;
  sw?: number;
}

interface BaseProps extends IconProps {
  d?: string;
  children?: React.ReactNode;
  fill?: string;
}

const Ic = ({ d, className = "w-5 h-5", sw = 1.6, children, fill }: BaseProps) => (
  <svg
    viewBox="0 0 24 24"
    fill={fill || "none"}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {d ? <path d={d} /> : children}
  </svg>
);

export const IconPlus = (p: IconProps) => <Ic {...p} d="M12 5v14M5 12h14" />;
export const IconUpload = (p: IconProps) => (
  <Ic
    {...p}
    d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
  />
);
export const IconTrash = (p: IconProps) => (
  <Ic
    {...p}
    d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.7 12.1A1.5 1.5 0 0 0 8.7 20.5h6.6a1.5 1.5 0 0 0 1.5-1.4L17.5 7"
  />
);
export const IconCheck = (p: IconProps) => <Ic {...p} d="M5 12.5 10 17.5 19.5 7" sw={2} />;
export const IconSend = (p: IconProps) => <Ic {...p} d="M5 12h13M12 5l7 7-7 7" />;
export const IconSun = (p: IconProps) => (
  <Ic
    {...p}
    d="M12 4.5v-2m0 19v-2m7.5-7.5h2m-19 0h2m12.7-5.2 1.4-1.4M5.4 18.6l1.4-1.4m11.8 0 1.4 1.4M5.4 5.4l1.4 1.4M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
  />
);
export const IconMoon = (p: IconProps) => (
  <Ic {...p} d="M20 13.5A8 8 0 0 1 10.5 4a7 7 0 1 0 9.5 9.5Z" />
);
export const IconChevron = (p: IconProps) => <Ic {...p} d="M6 9.5 12 15.5 18 9.5" />;
export const IconAlert = (p: IconProps) => (
  <Ic {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v4.5M12 16h.01" />
  </Ic>
);
export const IconClose = (p: IconProps) => <Ic {...p} d="M6 6l12 12M18 6 6 18" />;
export const IconMenu = (p: IconProps) => <Ic {...p} d="M4 7h16M4 12h16M4 17h16" />;
export const IconQuote = (p: IconProps) => (
  <Ic
    {...p}
    d="M9 7H6.5A1.5 1.5 0 0 0 5 8.5V12m4-5v5a3 3 0 0 1-3 3H5m14-8h-2.5A1.5 1.5 0 0 0 15 8.5V12m4-5v5a3 3 0 0 1-3 3h-1"
  />
);
export const IconRetry = (p: IconProps) => (
  <Ic {...p} d="M19 12a7 7 0 1 1-2.05-4.95M19 4v3.5h-3.5" />
);
export const IconStop = (p: IconProps) => (
  <Ic {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
  </Ic>
);
export const IconExternal = (p: IconProps) => (
  <Ic
    {...p}
    d="M14 5h5v5M18.5 5.5 11 13M12 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V12"
  />
);
export const IconSearch = (p: IconProps) => (
  <Ic {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.5-3.5M8.5 11h5" />
  </Ic>
);

// Dokument-Glyph — Outline-Body mit Eckfalz
export const IconDoc = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M6 3.5h7.5L18.5 8.5V19A1.5 1.5 0 0 1 17 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 3.5V8.5H18.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

// Markenzeichen — drei gestapelte Blätter, indigo
export const Logo = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
    <rect
      x="5.5"
      y="3.5"
      width="14"
      height="18"
      rx="3"
      className="fill-accent-600"
      transform="rotate(-7 12.5 12.5)"
      opacity="0.32"
    />
    <rect
      x="6.5"
      y="4.5"
      width="14"
      height="18"
      rx="3"
      className="fill-accent-600"
      transform="rotate(-2 13.5 13.5)"
      opacity="0.55"
    />
    <rect x="7.5" y="5.5" width="14" height="18" rx="3" className="fill-accent-600" />
    <path d="M11 11.5h7M11 15h5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// Spinner-Ring
export const Spinner = ({
  className = "w-4 h-4",
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={className + " animate-spin"}
    style={{ animationDuration: "0.8s" }}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2.4" opacity="0.2" />
    <path
      d="M12 3a9 9 0 0 1 9 9"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);
