import type { SVGProps } from "react";

export type IconName =
  | "overview"
  | "chat"
  | "document"
  | "workspace"
  | "history"
  | "favorite"
  | "settings"
  | "upload"
  | "arrow"
  | "logout"
  | "menu"
  | "spark"
  | "plus"
  | "close"
  | "send";

const paths: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  chat: (
    <>
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-9.5a7.5 7.5 0 1 1 17 0Z" />
      <path d="M8 10h8M8 13.5h5" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M8 12h8M8 16h8" />
    </>
  ),
  workspace: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M3 10h18M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  favorite: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  ),
  settings: (
    <>
      <path
        d="M10 3h4l.7 2.1 1.8.8 2-.9 2.8 2.8-.9 2 .8 1.8L23 12v4l-2.1.7-.8 1.8.9 2-2.8 2.8-2-.9-1.8.8L14 25h-4l-.7-2.1-1.8-.8-2 .9-2.8-2.8.9-2-.8-1.8L1 16v-4l2.1-.7.8-1.8-.9-2L5.8 4l2 .9 1.8-.8L10 3Z"
        transform="translate(2 -2) scale(.83)"
      />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 16l4-4-4-4m4 4H9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  spark: (
    <>
      <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  send: (
    <>
      <path d="m3 20 18-8L3 4l2.8 7 8.2 1-8.2 1L3 20Z" />
    </>
  ),
};

export function UiIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
