// A sound profile for each dream world, played by the ambient composer (ambient.js). Each one is a
// different little band: its own key, mode and time signature, chord colour, accompaniment, bass
// line and (very soft) percussion, so no two scenes sound alike.
//
// mode: major | dorian | lydian | mixolydian | minor | pentatonic | wholetone
// meter: 4, or 3 (a waltz, or a lilting 6/8); swing: 0..0.35 pushes the offbeats late
// harmony: seventh | triad | sus | open | quartal | add9
// pad: strings | organ | glass | reed (squeezebox) | warm (soft synth) | choir | none
// lead: flute | whistle | bell | musicbox | celesta | epiano | marimba | harp | pluck | mandolin | choir
// leadStyle: wander (default) | sparse (few long notes) | canon (echoed an octave down, two beats on)
// arp: broken | up | alberti | strum | waltz (oom-pah-pah) | twinkle | rock; arpVoice: harp | guitar | celesta | marimba | epiano
// bass: sub (a held low note, default) | roots | pulse | walk | none; perc: brush | shaker | heart | tick
// ambience levels are 0..1 (rates for events, levels for beds).
export const PROFILES = {
  // a pastoral song: flute over strings and a harp, warm add9 chords
  meadow: { mode: 'major', root: 53, bpm: [44, 52], harmony: 'add9', pad: 'strings', lead: 'flute', arp: 'broken', arpVoice: 'harp', ambience: { crickets: 1, owl: 1, wind: 0.02, horse: 1, gust: 0.6 } , level: 1.38 },
  // a drawing-room serenade: celesta over rising harp, a stately bass
  estate: { mode: 'lydian', root: 55, bpm: [52, 62], harmony: 'seventh', pad: 'strings', lead: 'celesta', arp: 'up', arpVoice: 'harp', bass: 'roots', ambience: { crickets: 0.8, water: 0.03, owl: 0.5, birds: 0.3 }, level: 1.0 },
  // a folk session in the corner: whistle, strummed guitar, brushes, a swung lilt
  woolpack: { mode: 'mixolydian', root: 50, bpm: [56, 68], swing: 0.3, harmony: 'triad', pad: 'organ', lead: 'whistle', arp: 'strum', arpVoice: 'guitar', bass: 'roots', perc: 'brush', ambience: { murmur: 0.022, fire: 0.012, crackle: 0.8, birds: 0.8, wind: 0.012 } , level: 0.98 },
  // water music: pentatonic bells, a harp rocking like the boat
  canal: { mode: 'pentatonic', root: 52, bpm: [42, 50], harmony: 'triad', pad: 'glass', lead: 'bell', leadStyle: 'sparse', arp: 'rock', arpVoice: 'harp', bass: 'none', ambience: { water: 0.035, duck: 1, wind: 0.015, crickets: 0.5, owl: 0.6 }, level: 0.96 },
  // a slow air in three: a low flute, open sus chords, a soft synth bed
  stables: { mode: 'dorian', root: 57, bpm: [54, 64], meter: 3, harmony: 'sus', pad: 'warm', lead: 'flute', leadOct: -1, leadStyle: 'sparse', arp: 'broken', arpVoice: 'guitar', bass: 'roots', ambience: { horse: 2.5, wind: 0.02, room: 0.02, gust: 1, owl: 0.6 } , level: 0.9 },
  // a winter waltz: oom-pah-pah harp, a celesta tune, sleigh bells
  market: { mode: 'major', root: 55, bpm: [72, 84], meter: 3, harmony: 'triad', pad: 'strings', lead: 'celesta', leadStyle: 'canon', canonVoice: 'musicbox', arp: 'waltz', arpVoice: 'harp', bass: 'none', ambience: { murmur: 0.016, wind: 0.02, steps: 0.6, surface: 'snow', jingle: 1, bell: 0.7 }, level: 2.0 },
  // a walking song: whistle, rising guitar, open fifths and a steady bass
  trail: { mode: 'mixolydian', root: 52, bpm: [56, 68], harmony: 'open', pad: 'strings', lead: 'whistle', arp: 'up', arpVoice: 'guitar', bass: 'pulse', ambience: { steps: 1, birds: 1.2, wind: 0.02, gust: 1 } , level: 1.35 },
  // plainsong: the choir sings and the stone answers back
  choir: { mode: 'dorian', root: 50, bpm: [40, 48], harmony: 'open', pad: 'choir', lead: 'choir', leadStyle: 'canon', beatsPerChord: 10, verb: 1.1, ambience: { room: 0.03 }, level: 2.0 },
  // late-night jazz for a cat: electric piano, walking bass, brushes, swing
  penny: { mode: 'major', root: 53, bpm: [50, 60], swing: 0.33, harmony: 'seventh', pad: 'none', lead: 'epiano', arp: 'strum', arpVoice: 'epiano', bass: 'walk', bassVel: 0.08, perc: 'brush', ambience: { purr: 0.05, fire: 0.008, crackle: 0.4, wind: 0.01, owl: 0.5 }, level: 1.34 },
  // a slow tarantella: mandolin tremolo, accordion, oom-pah-pah guitar, a tambourine whisper
  pizza: { mode: 'major', root: 52, bpm: [70, 82], meter: 3, harmony: 'triad', pad: 'reed', lead: 'mandolin', arp: 'waltz', arpVoice: 'guitar', bass: 'none', perc: 'shaker', percVel: 0.8, ambience: { fire: 0.016, crackle: 1, murmur: 0.012 }, level: 2.0 },
  // puzzled: a marimba wandering over quartal chords, a compass ticking, plodding bass
  lost: { mode: 'dorian', root: 57, bpm: [50, 60], harmony: 'quartal', pad: 'glass', lead: 'marimba', bass: 'pulse', perc: 'tick', ambience: { crickets: 1, owl: 1.2, wind: 0.02, steps: 0.5 }, level: 0.75 },
  // a stadium lullaby: a soft synth, rising celesta, the crowd humming along, a heartbeat
  stardome: { mode: 'lydian', root: 54, bpm: [56, 68], harmony: 'add9', pad: 'warm', lead: 'choir', arp: 'up', arpVoice: 'celesta', bass: 'pulse', perc: 'heart', ambience: { wind: 0.01 }, level: 1.15 },
  // a whole-tone dream in three: augmented chords, a wobbly pad, marimba echoed by celesta
  fever: { mode: 'wholetone', root: 54, bpm: [50, 60], meter: 3, harmony: 'triad', pad: 'glass', wobble: 22, lead: 'marimba', leadStyle: 'canon', canonVoice: 'celesta', arp: 'twinkle', arpVoice: 'celesta', bass: 'none', verb: 1, ambience: { wind: 0.012, crickets: 0.4, gust: 0.4 }, level: 0.9 },
  // a baroque morning: harpsichord-ish pluck, Alberti broken chords, a walking continuo
  bakery: { mode: 'major', root: 55, bpm: [56, 66], harmony: 'triad', pad: 'organ', lead: 'pluck', arp: 'alberti', arpVoice: 'guitar', bass: 'walk', bassVel: 0.06, ambience: { fire: 0.014, crackle: 0.9, birds: 0.5, room: 0.015 } , level: 1.25 },
};
