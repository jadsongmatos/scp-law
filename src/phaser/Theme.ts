export const SCP = {
  safe:     { hex: '#33cc33', num: 0x33cc33, hsl: 'hsl(120 50% 50%)' },
  euclid:   { hex: '#ccaa33', num: 0xccaa33, hsl: 'hsl(45 60% 50%)' },
  keter:    { hex: '#cc3333', num: 0xcc3333, hsl: 'hsl(0 55% 50%)' },
  thaumiel: { hex: '#9933cc', num: 0x9933cc, hsl: 'hsl(280 40% 50%)' },
  apollyon: { hex: '#660011', num: 0x660011, hsl: 'hsl(345 60% 20%)' },
} as const;

export type SCPClass = keyof typeof SCP;

export const INTERACTABLE_CLASS: Record<string, SCPClass> = {
  inspect:       'safe',
  pickup:        'safe',
  travel:        'euclid',
  terminal_read: 'keter',
  phone_call:    'thaumiel',
};

export const EVENT_CLASS: Record<string, SCPClass> = {
  pickup:              'safe',
  'deduction-correct': 'safe',
  contact:             'euclid',
  'deduction-incomplete':'euclid',
  denied:              'keter',
  'deduction-wrong':   'keter',
};

export const COLORS = {
  amber:       '#d4a017',
  amberBright: '#ffcc33',
  green:       '#33ff33',
  red:         '#cc3333',
  purple:      '#9933cc',

  bgDark:      '#0a0a0a',
  bgPanel:     '#111111',
  bgCard:      '#1a1a1a',
  bgHover:     '#2a1a00',
  bgGreenHover:'#0a2a0a',

  textPrimary: '#cccccc',
  textSecondary: '#888888',
  textMuted: '#666666',
  textDim: '#555555',
  textFaint: '#333333',

  textPrimaryNum: 0xcccccc,
  textSecondaryNum: 0x888888,
  textMutedNum: 0x666666,
  textDimNum: 0x555555,
  textFaintNum: 0x333333,

  amberStroke: 0xd4a017,
  greenStroke: 0x33ff33,
  purpleStroke: 0x9933cc,

  bgDarkNum:    0x0a0a0a,
  bgPanelNum:   0x111111,
  bgCardNum:    0x1a1a1a,
  bgHoverNum:   0x2a1a00,
  bgGreenHoverNum: 0x0a2a0a,
  bgItemNum:    0x1a1a0a,

  black:        0x000000,
  white:        0xffffff,
} as const;

export const FONTS = {
  display: '"Playfair Display", serif',
  mono:    '"JetBrains Mono", monospace',
} as const;

export const FONT_STYLES = {
  title:     { fontFamily: FONTS.display, fontSize: '64px', color: COLORS.amber } as const,
  subtitle:  { fontFamily: FONTS.display, fontSize: '24px', color: COLORS.textSecondary } as const,
  header:    { fontFamily: FONTS.display, fontSize: '18px', color: COLORS.amber } as const,
  body:      { fontFamily: FONTS.mono,    fontSize: '16px', color: COLORS.textPrimary } as const,
  small:     { fontFamily: FONTS.mono,    fontSize: '13px', color: COLORS.textSecondary } as const,
  label:     { fontFamily: FONTS.mono,    fontSize: '11px', color: COLORS.textMuted } as const,
  tiny:      { fontFamily: FONTS.mono,    fontSize: '10px', color: COLORS.textMuted } as const,
  mono:      { fontFamily: FONTS.mono,    fontSize: '12px', color: COLORS.textPrimary } as const,
  monoAmber: { fontFamily: FONTS.mono,    fontSize: '12px', color: COLORS.amber } as const,
  monoGreen: { fontFamily: FONTS.mono,    fontSize: '12px', color: COLORS.green } as const,
  monoRed:   { fontFamily: FONTS.mono,    fontSize: '12px', color: COLORS.red } as const,
  button:    { fontFamily: FONTS.mono,    fontSize: '20px', color: COLORS.amber } as const,
  btnSmall:  { fontFamily: FONTS.mono,    fontSize: '11px', color: COLORS.amber } as const,
} as const;

export const SKELETON_BG: Record<SCPClass, { gradient: number[]; alpha: number[] }> = {
  safe:     { gradient: [0x1a2a1a, 0x243324, 0x1c2e1c], alpha: [1, 1, 1] },
  euclid:   { gradient: [0x2a2414, 0x33291a, 0x2e2618], alpha: [1, 1, 1] },
  keter:    { gradient: [0x2a1414, 0x331a1a, 0x2e1818], alpha: [1, 1, 1] },
  thaumiel: { gradient: [0x1e142a, 0x241a33, 0x201830], alpha: [1, 1, 1] },
  apollyon: { gradient: [0x150510, 0x1a0a14, 0x180812], alpha: [1, 1, 1] },
};

export const SHIMMER_ALPHA: Record<SCPClass, number> = {
  safe:     0.12,
  euclid:   0.15,
  keter:    0.20,
  thaumiel: 0.20,
  apollyon: 0.20,
};

export function scpColor(cls: SCPClass): string  { return SCP[cls].hex; }
export function scpNum(cls: SCPClass): number    { return SCP[cls].num; }
export function scpStroke(cls: SCPClass, alpha = 0.5): { color: number; alpha: number } {
  return { color: SCP[cls].num, alpha };
}
