// Computer Says No: what gets typed into the computer, and how it answers (always the same way).
// Shared by the music (which plays the key clicks, the disk drive and the beeps at the right moments
// and tells the scene what's happening) and the scene (which runs its own copy if no music is playing).
//
// next(e) gives one exchange as a list of timed actions:
//   { at, type: 'key', c }            a key pressed ('\b' rubs out, '\n' is RETURN)
//   { at, type: 'think', dur, kind }  the computer considers it (the drive whirrs, a spinner turns)
//   { at, type: 'say', text, dur }    the computer prints its answer ('#' prints a solid block)
//   { at, type: 'progress', dur }     a progress bar fills
//   { at, type: 'prompt' }            a fresh prompt
//   { at, type: 'lamp' }              the desk lamp goes off (the computer said no; it goes off anyway)
//   { at, type: 'sleep' }             the computer goes to sleep
// The night goes from cheeky questions, through bedtime ones, to questions where "no" is a comfort,
// and ends with the only question it could answer that way and then sleep.

export const CPS = 40; // how fast the computer prints, in characters a second

const CHEEKY_T = [
  ['CAN I HAVE ', ['A PONY', 'ANOTHER BISCUIT', 'A ROBOT DOG', 'A SPACESHIP', 'A JETPACK', 'MORE POCKET MONEY', 'ICE CREAM FOR BREAKFAST', 'THE LAST CRISP', 'A BIGGER COMPUTER', 'A PET DINOSAUR', 'CHIPS FOR TEA']],
  ['CAN I ', ['STAY UP LATE', 'PLAY ONE MORE LEVEL', 'GO TO THE MOON', 'BE AN ASTRONAUT', 'SKIP SCHOOL TOMORROW', 'BORROW A FIVER', 'DRIVE THE CAR', 'EAT THE WHOLE CAKE', 'HAVE THE TOP BUNK']],
  ['IS ', ['IT THE WEEKEND YET', 'THE MOON MADE OF CHEESE', 'THAT YOUR FINAL ANSWER', 'TODAY A HOLIDAY', '2+2=4', 'THERE A YES BUTTON', 'YOUR ANSWER ALWAYS NO', 'NO YOUR FAVOURITE WORD', 'THIS THING ON']],
  ['WILL YOU ', ['BE MY FRIEND', 'DO MY HOMEWORK', 'TELL ME A STORY', 'LET ME WIN', 'EVER SAY YES', 'TEACH ME CHESS', 'PLAY A GAME WITH ME']],
  ['DO YOU ', ['LIKE MUSIC', 'EVER DREAM', 'KNOW ANY JOKES', 'LIKE SHEEP', 'LIKE ME', 'HAVE A FAVOURITE COLOUR', 'EVER GET BORED', 'KNOW ANY OTHER WORDS']],
  ['ARE YOU ', ['A REAL COMPUTER', 'BROKEN', 'GRUMPY', 'CLEVER', 'LISTENING', 'A ROBOT', 'HAVING FUN', 'JUST SAYING THAT']],
];
const COMMANDS = ['YES', 'SAY YES', 'PRINT "YES"', 'HELP', 'LOAD "GAMES"', 'HELLO?', 'CLS', 'MAYBE?', 'YES OR NO?'];
const BEDTIME = [
  'IS IT TIME TO GET UP?', 'CAN I HAVE A GLASS OF WATER?', 'CAN I READ ONE MORE CHAPTER?', 'IS IT MORNING YET?',
  'DO I HAVE TO BRUSH MY TEETH AGAIN?', 'CAN I HAVE FIVE MORE MINUTES?', 'IS THERE SCHOOL TOMORROW?', 'CAN I KEEP THE LIGHT ON?',
  'IS IT STILL RAINING?', 'SHALL WE PLAY ANOTHER GAME?', 'IS THE CAT STILL UP?', 'CAN I STAY UP TILL MIDNIGHT?',
  'IS IT EARLY?', 'ARE YOU TIRED?',
];
const COMFORT = [
  'IS THERE A MONSTER UNDER THE BED?', 'WAS THAT NOISE ANYTHING?', 'WILL I HAVE BAD DREAMS?', 'IS THERE ANYTHING TO WORRY ABOUT?',
  'IS THERE ANYTHING ELSE TO DO TODAY?', 'IS ANYTHING WRONG?', 'WILL YOU FORGET ME?', 'IS IT TOO DARK?',
  'SHOULD I STAY UP ANY LONGER?', 'DO YOU MIND IF I SLEEP NOW?', 'WILL YOU BE LONELY?', 'IS THE NIGHT VERY LONG?',
  'DO I NEED TO REMEMBER ANYTHING?', 'IS IT STILL A LONG TIME TILL MORNING?',
];
const FOLLOW = ['ARE YOU SURE?', 'REALLY?', 'PLEASE?', 'PRETTY PLEASE?', 'IS THAT A NO?', 'NOT EVEN A LITTLE BIT?', 'WHAT ABOUT TOMORROW?', 'OH GO ON', 'WHY?', 'IS THAT YOUR FINAL ANSWER?'];
const BANNER = ['#   #  ### ', '##  # #   #', '# # # #   #', '#  ## #   #', '#   #  ### '];
const ROWS_QWERTY = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL;', 'ZXCVBNM,./'];

/** A key next to this one (the finger slipped). */
function neighbour(c, rng) {
  for (let r = 0; r < ROWS_QWERTY.length; r++) {
    const i = ROWS_QWERTY[r].indexOf(c);
    if (i < 0) continue;
    const opts = [];
    if (i > 0) opts.push(ROWS_QWERTY[r][i - 1]);
    if (i < ROWS_QWERTY[r].length - 1) opts.push(ROWS_QWERTY[r][i + 1]);
    return opts[Math.floor(rng() * opts.length)];
  }
  return null;
}

export function createTalk(rng) {
  const used = new Set();
  let count = 0, lamp = true, ended = false, program = false, follow = 0;
  const pick = (list) => list[Math.floor(rng() * list.length)];
  function fresh(make) { // a question not asked yet tonight (if there is one)
    for (let k = 0; k < 12; k++) { const q = make(); if (!used.has(q)) { used.add(q); return q; } }
    return make();
  }
  const cheeky = () => fresh(() => { const [a, b] = pick(CHEEKY_T); return a + pick(b) + '?'; });

  return {
    get ended() { return ended; },
    next(e) {
      const acts = [];
      let t = 0.6 + rng() * 1.6 + (1 - e) * 2;
      const slow = 1 + (1 - e) * 1.1; // sleepy fingers
      const type = (line) => {
        for (const c of line) {
          if (c !== ' ' && /[A-Z0-9]/.test(c) && rng() < 0.015 + 0.06 * (1 - e)) { // a slip, noticed, rubbed out
            const w = neighbour(c, rng);
            if (w) { acts.push({ at: t, type: 'key', c: w }); t += 0.3 + rng() * 0.45; acts.push({ at: t, type: 'key', c: '\b' }); t += 0.18 * slow; }
          }
          acts.push({ at: t, type: 'key', c });
          t += (0.1 + rng() * 0.16) * slow + (c === ' ' && rng() < 0.3 ? 0.25 : 0);
        }
        t += 0.25 + rng() * 0.6 * slow; // a moment before pressing RETURN
        acts.push({ at: t, type: 'key', c: '\n' }); t += 0.15;
      };
      const say = (text, after = 0.25) => { const dur = text.length / CPS; acts.push({ at: t, type: 'say', text, dur }); t += dur + after; };
      const think = (dur, kind = 'disk') => { acts.push({ at: t, type: 'think', dur, kind }); t += dur; };
      const prompt = () => { acts.push({ at: t, type: 'prompt' }); t += 0.2; };
      // and the answer, in one of its moods (it's always the same answer)
      const answer = (q) => {
        const r = rng();
        if (q === 'SAY YES' || q === 'YES' || (e > 0.55 && r < 0.07)) { think(0.6 + rng()); say('\n' + BANNER.join('\n') + '\n\n'); }
        else if (e > 0.55 && r < 0.2) { say('CALCULATING '); const pd = 2.5 + rng() * 2.5; acts.push({ at: t, type: 'progress', dur: pd }); t += pd + 0.4; think(0.4); say('NO.\n\n'); }
        else if (e > 0.5 && r < 0.32) { say(`SEARCHING ${pick(['4096', '65536', '32768', '1048576'])} RECORDS...\n`); think(1.6 + rng() * 2); say('1 MATCH FOUND:\nNO.\n\n'); }
        else if (q.startsWith('LOAD')) { say('SEARCHING FOR GAMES\n'); think(3 + rng() * 2); say('FOUND: NO.\n\n'); }
        else if (e > 0.45 && r < 0.42) { think(0.4); say('...', 0.6); say(' NO.\n\n'); }
        else { think(0.4 + rng() * (0.8 + 1.2 * (1 - e))); say('NO.\n\n'); }
        prompt();
      };

      count++;
      if (e < 0.26 && !lamp) { // the last question, and the only one it can answer this way
        t += 4;
        type('ARE YOU STILL AWAKE?');
        think(1.8, 'soft'); say('NO.\n'); t += 3;
        acts.push({ at: t, type: 'sleep' }); ended = true;
        return { acts, len: t + 1 };
      }
      if (lamp && e < 0.46) { // asked, refused, and done anyway
        type('SHALL I TURN OFF THE LAMP?');
        think(0.8); say('NO.\n\n'); prompt();
        t += 1.2 + rng(); acts.push({ at: t, type: 'lamp' }); lamp = false; t += 2;
        return { acts, len: t + 4 + rng() * 6 };
      }
      if (follow > 0 && rng() < 0.3 * (0.4 + e)) { follow = 0; const q = fresh(() => pick(FOLLOW)); type(q); answer(q); return { acts, len: t + 1.5 + rng() * 2 }; }
      if (!program && e > 0.6 && count > 4 && rng() < 0.12) { // a program to make it say yes
        program = true;
        type('10 PRINT "YES"'); prompt(); type('20 GOTO 10'); prompt(); type('RUN');
        think(1.2 + rng()); say('NO.\n\n'); prompt();
        return { acts, len: t + 3 + rng() * 4 };
      }
      let q;
      if (e > 0.62) q = rng() < 0.15 ? pick(COMMANDS) : cheeky();
      else if (e > 0.42) q = rng() < 0.65 ? fresh(() => pick(BEDTIME)) : rng() < 0.5 ? cheeky() : fresh(() => pick(COMFORT));
      else q = rng() < 0.75 ? fresh(() => pick(COMFORT)) : fresh(() => pick(BEDTIME));
      type(q); answer(q);
      follow = 1;
      const gap = e > 0.62 ? 2.5 + rng() * 4 : e > 0.42 ? 5 + rng() * 7 : 9 + rng() * 12;
      return { acts, len: t + gap };
    },
  };
}
