import { SampleImage } from './types';

export const CATEGORY_COLORS: Record<string, string> = {
  Person: '#00f2fe',        // Neon Cyan
  Face: '#38bdf8',          // Bright Sky Blue
  Clothing: '#ee0979',      // Neon Coral
  Apparel: '#ee0979',       // Neon Coral
  Accessory: '#f43f5e',     // Bright Rose
  Sign: '#facc15',          // Vibrant Gold / Amber
  Vehicle: '#ff6a00',       // Electric Orange
  Infrastructure: '#ffb300',// Neon Amber
  Electronics: '#9d4edd',   // Cyber Purple
  Furniture: '#05df9d',     // Neon Emerald
  Food: '#eab308',          // Vibrant Yellow
  Animal: '#38bdf8',        // Sky Blue
  Nature: '#10b981',        // Vibrant Mint
  Architecture: '#3b82f6',  // Cobalt Blue
  Tool: '#ec4899',          // Hot Pink
  Item: '#a855f7',          // Purple
  Other: '#94a3b8',         // Cool Slate
};

export function getCategoryColor(category: string): string {
  const normalized = Object.keys(CATEGORY_COLORS).find(
    k => k.toLowerCase() === category.toLowerCase()
  );
  if (normalized) return CATEGORY_COLORS[normalized];
  
  // Category heuristic fallbacks
  const cat = category.toLowerCase();
  if (cat.includes('face') || cat.includes('head')) return CATEGORY_COLORS.Face;
  if (cat.includes('human') || cat.includes('man') || cat.includes('woman') || cat.includes('child') || cat.includes('actor') || cat.includes('person')) return CATEGORY_COLORS.Person;
  if (cat.includes('shirt') || cat.includes('jacket') || cat.includes('trouser') || cat.includes('cloth') || cat.includes('pant') || cat.includes('dress') || cat.includes('wear')) return CATEGORY_COLORS.Clothing;
  if (cat.includes('sign') || cat.includes('board') || cat.includes('card') || cat.includes('text') || cat.includes('banner')) return CATEGORY_COLORS.Sign;
  if (cat.includes('glass') || cat.includes('watch') || cat.includes('hat') || cat.includes('access')) return CATEGORY_COLORS.Accessory;
  if (cat.includes('car') || cat.includes('bike') || cat.includes('truck') || cat.includes('auto') || cat.includes('vehicle')) return CATEGORY_COLORS.Vehicle;
  if (cat.includes('light') || cat.includes('road')) return CATEGORY_COLORS.Infrastructure;
  if (cat.includes('computer') || cat.includes('phone') || cat.includes('screen')) return CATEGORY_COLORS.Electronics;
  if (cat.includes('table') || cat.includes('chair') || cat.includes('desk') || cat.includes('couch') || cat.includes('seat')) return CATEGORY_COLORS.Furniture;
  if (cat.includes('fruit') || cat.includes('dish') || cat.includes('drink') || cat.includes('meal')) return CATEGORY_COLORS.Food;
  if (cat.includes('dog') || cat.includes('cat') || cat.includes('bird')) return CATEGORY_COLORS.Animal;
  if (cat.includes('tree') || cat.includes('plant') || cat.includes('flower')) return CATEGORY_COLORS.Nature;
  if (cat.includes('building') || cat.includes('house') || cat.includes('wall')) return CATEGORY_COLORS.Architecture;

  // Stable hash fallback color
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [185, 25, 45, 275, 155, 335, 215, 85];
  const hue = hues[Math.abs(hash) % hues.length];
  return `hsl(${hue}, 90%, 55%)`;
}

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample-actor-collage',
    title: 'High-Density Photo Collage',
    category: 'People & Objects Montage',
    description: 'Multi-panel celebrity montage with multiple group gatherings, distinct faces, handheld signs, and apparel.',
    url: '/assets/aistudio/image_6f266380.png',
  },
  {
    id: 'sample-street',
    title: 'Urban Traffic & Intersection',
    category: 'Traffic & Pedestrians',
    description: 'High-density downtown intersection with moving cars, walking pedestrians, traffic signals, and storefronts.',
    url: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'sample-workspace',
    title: 'Modern Tech Workspace',
    category: 'Electronics & Office',
    description: 'Desk setup featuring dual monitors, mechanical keyboard, wireless mouse, headphones, and coffee mug.',
    url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'sample-living',
    title: 'Contemporary Living Space',
    category: 'Interior & Furniture',
    description: 'Stylized lounge with mid-century sofa, coffee table, decorative ceramics, indoor plants, and artwork.',
    url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'sample-kitchen',
    title: 'Artisan Culinary Kitchen',
    category: 'Food & Culinary',
    description: 'Fresh vegetables, cutting board, kitchen knives, olive oil bottle, cookware, and culinary ingredients.',
    url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'sample-park',
    title: 'Sunny City Park',
    category: 'People & Nature',
    description: 'Open green lawn with people picnicking, cyclists, park benches, large oak trees, and backpacks.',
    url: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=1200&q=80',
  },
];

export const QUICK_PRESETS = [
  {
    id: 'all-objects',
    title: 'Detect & highlight all objects',
    subtitle: 'Comprehensive multi-level spatial scan',
    mode: 'all' as const,
    prompt: 'Detect and localize every recognizable physical object across foreground, midground, and background.',
  },
  {
    id: 'people-clothing',
    title: 'Identify people, faces & apparel',
    subtitle: 'Individual persons, faces, clothes & signs',
    mode: 'people' as const,
    prompt: 'Identify all people and specify visible clothing types, colors, accessories, and poses.',
  },
  {
    id: 'primary-subject',
    title: 'Primary subject focal analysis',
    subtitle: 'Identify key subject & context',
    mode: 'scene' as const,
    prompt: 'What is the primary subject in the scene and how does it relate spatially to surrounding objects?',
  },
  {
    id: 'vehicles-pedestrians',
    title: 'Locate vehicles or pedestrians',
    subtitle: 'Cars, bikes, buses & walkers',
    mode: 'vehicles' as const,
    prompt: 'Locate, box, and classify all vehicles, moving transport, and pedestrians in the scene.',
  },
];
