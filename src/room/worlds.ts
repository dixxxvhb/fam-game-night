// Each game's world on the shelf: one ink color and the name of the place it happens.
// Colors echo the game's own look so the shelf reads like a lineup of shows.
export type World = { ink: string; place: string }

const WORLDS: Record<string, World> = {
  phases: { ink: '#FFD23F', place: 'Card table' },
  aggro: { ink: '#FF4F9A', place: 'Marble run' },
  percent: { ink: '#2FD6B5', place: 'Operation Percent' },
  board: { ink: '#FF7AD9', place: "Mingo's park" },
  kart: { ink: '#FFB020', place: 'Sunshine Cup' },
  survive: { ink: '#A98BFF', place: 'The Grand Palmetto' },
  trivia: { ink: '#3DA9FF', place: 'Trivia Night LIVE' },
  quip: { ink: '#FF6B3D', place: 'The House' },
  bluff: { ink: '#F45B69', place: 'Lie detector' },
  fakeword: { ink: '#7BD389', place: 'The dictionary' },
  sketch: { ink: '#4ECDC4', place: 'Sketchbook' },
  drawbluff: { ink: '#FF9F1C', place: 'The gallery' },
  telephone: { ink: '#C49BFF', place: 'Party line' },
  melon: { ink: '#8BE05A', place: 'Fruit stand' },
  categories: { ink: '#FF5D8F', place: 'The Letter Machine' },
  forehead: { ink: '#E05CFF', place: 'The Club' },
  bowl: { ink: '#39F28A', place: 'Neon alley' },
  arena: { ink: '#FF4A3D', place: 'Fireworks pit' },
}

export function worldOf(gameId: string): World {
  return WORLDS[gameId] ?? { ink: '#FF6B3D', place: 'Game night' }
}
