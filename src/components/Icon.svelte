<script lang="ts" module>
  // Stroke icons, 24×24, drawn with currentColor.
  const PATHS: Record<string, string> = {
    back: 'M15 18l-6-6 6-6',
    next: 'M9 6l6 6-6 6',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7',
    edit: 'M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z',
    pen: 'M3 21l3.5-1 12-12-2.5-2.5-12 12zM14.5 5.5l4 4',
    marker: 'M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
    eraser: 'M20 20H8.5l-4.9-4.9a1.5 1.5 0 0 1 0-2.1L13 3.6a1.5 1.5 0 0 1 2.1 0l5.3 5.3a1.5 1.5 0 0 1 0 2.1L11.5 20M8 9l7 7',
    undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
    download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
    file: 'M14 3H6v18h12V7zM14 3v4h4M9 12h6M9 16h6',
    note: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5',
    noteOff: 'M6 3h9l4 4v14H6zM3 3l18 18',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    alert: 'M12 3l9.5 17h-19zM12 10v4M12 17.5v.5',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.5',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    sync: 'M20 12a8 8 0 0 1-14 5.3M4 12A8 8 0 0 1 18 6.7M18 3v4h-4M6 21v-4h4',
    cloudOff: 'M7 18h10a4 4 0 0 0 1.5-7.7M16 6.5A6 6 0 0 0 6.2 9.2 4.5 4.5 0 0 0 7 18M3 3l18 18',
    cloud: 'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.2 4.5 4.5 0 0 0 7 18zM9.5 13.5l2 2 3.5-3.5',
    settings:
      'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    highlight: 'M4 20h16M7 15l8.5-8.5a2 2 0 0 1 3 3L10 18H7z',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
    shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  };
</script>

<script lang="ts">
  let { name, size = 20, filled = false }: { name: string; size?: number; filled?: boolean } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"><path d={PATHS[name] ?? ''} /></svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
