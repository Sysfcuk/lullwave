// A sound profile for each dream world, played by the ambient composer (ambient.js).
// pad: 'strings' | 'choir' | 'organ' | 'glass'; lead: 'flute' | 'bell' | 'musicbox' | 'epiano' |
// 'pluck' | 'mandolin' | 'choir'; ambience levels are 0..1 (rates for events, levels for beds).
export const PROFILES = {
  meadow: { mode: 'major', bpm: [46, 56], pad: 'strings', lead: 'flute', arp: true, ambience: { crickets: 1, owl: 1, wind: 0.02, horse: 1, gust: 0.6 } },
  estate: { mode: 'lydian', bpm: [50, 62], pad: 'strings', lead: 'pluck', arp: true, ambience: { crickets: 0.8, water: 0.03, owl: 0.5, birds: 0.3 }, level: 1.25 },
  woolpack: { mode: 'mixolydian', bpm: [54, 66], pad: 'organ', lead: 'flute', arp: true, ambience: { murmur: 0.022, fire: 0.012, crackle: 0.8, birds: 0.8, wind: 0.012 } },
  canal: { mode: 'major', bpm: [44, 54], pad: 'glass', lead: 'bell', ambience: { water: 0.035, duck: 1, wind: 0.015, crickets: 0.5, owl: 0.6 }, level: 0.9 },
  stables: { mode: 'dorian', bpm: [44, 52], pad: 'strings', lead: 'flute', ambience: { horse: 2.5, wind: 0.02, room: 0.02, gust: 1, owl: 0.6 } },
  market: { mode: 'major', bpm: [52, 62], pad: 'strings', lead: 'musicbox', arp: true, ambience: { murmur: 0.016, wind: 0.02, steps: 0.6, surface: 'snow', jingle: 1, bell: 0.7 }, level: 1.2 },
  trail: { mode: 'mixolydian', bpm: [54, 66], pad: 'strings', lead: 'flute', arp: true, ambience: { steps: 1, birds: 1.2, wind: 0.02, gust: 1 } },
  choir: { mode: 'dorian', bpm: [40, 48], pad: 'choir', lead: 'choir', beatsPerChord: 10, verb: 1.1, ambience: { room: 0.03 }, level: 1.9 },
  penny: { mode: 'major', bpm: [48, 58], pad: 'glass', lead: 'musicbox', ambience: { purr: 0.05, fire: 0.008, crackle: 0.4, wind: 0.01, owl: 0.5 }, level: 0.9 },
  pizza: { mode: 'major', bpm: [56, 68], pad: 'strings', lead: 'mandolin', arp: true, ambience: { fire: 0.016, crackle: 1, murmur: 0.012 }, level: 1.2 },
  lost: { mode: 'dorian', bpm: [48, 58], pad: 'glass', lead: 'flute', ambience: { crickets: 1, owl: 1.2, wind: 0.02, steps: 0.5 }, level: 0.9 },
  stardome: { mode: 'lydian', bpm: [56, 70], pad: 'glass', lead: 'epiano', arp: true, beatsPerChord: 8, ambience: { wind: 0.01 }, level: 0.95 },
  bakery: { mode: 'major', bpm: [50, 60], pad: 'organ', lead: 'pluck', arp: true, ambience: { fire: 0.014, crackle: 0.9, birds: 0.5, room: 0.015 } },
};
