// Stage pools for the Lily58 trainer — small charsets, heavy repetition (typing.com style).
// Every character in every item must resolve via the lily58 board's charToKey();
// enforced by tests/lessons.test.js.
export const POOLS = {
  // home row (unchanged positions) — warm-up + baseline
  'home-row': [
    'a', 's', 'd', 'f', 'h', 'j', 'k', 'l',
    'as', 'ad', 'af', 'sa', 'fa', 'ha', 'ja', 'la',
    'ash', 'ask', 'dad', 'fall', 'flash', 'half', 'lad', 'sad',
    'salad', 'slash', 'all', 'has', 'had', 'lass', 'aah', 'fad',
  ],
  // bottom-left: Z X C V (one column right) — typing.com rule: every drill returns home
  'bottom-left': [
    'z', 'x', 'c', 'v',
    'sz', 'zs', 'dx', 'xd', 'fc', 'cf', 'fv', 'vf',
    'vad', 'fax', 'sax', 'caf', 'gas', 'vac', 'cad', 'fad',
    'had', 'sad', 'lad', 'lag', 'dash', 'flash', 'clash', 'salad',
    'lava', 'vax', 'sac', 'casa', 'salsa', 'fava',
  ],
  // bottom-right: B under right index; N M shifted right — drills anchor to home row
  'bottom-right': [
    'b', 'n', 'm',
    'kb', 'bk', 'jn', 'nj', 'mj', 'jm',
    'ban', 'nab', 'man', 'jam', 'ham', 'bam',
    'bag', 'lab', 'nag', 'jab', 'mash', 'bang',
    'bask', 'mall', 'ball', 'fall', 'half', 'lamb',
    'bank', 'bland', 'glam', 'mamba', 'jamb', 'blam',
  ],
  // punctuation + shift combos — mixed with home-row letters so hands stay anchored
  'punctuation-shift': [
    ',', '.', '/', ';', '-',
    ',.', './', ';,', '-,', '.,', ',;',
    'a,', 's.', 'd/', 'f;', 'j,', 'k.', 'l;',
    ',a', '.s', '/d', ';f', ',j', '.k', ';l',
    '<a', 'a>', '?j', ':k', '_l', 'a<', '>s',
    'k?', 'l:', 'a_', ';:', '?/', '<>', '?:', '<_>',
    'a.b', 'j.k', 'f;g', 's,ad', 'd-f', 'l,k',
  ],
  // real-world sentences in the full base charset (letters + space + basic punctuation)
  'sentences': [
    'The quick brown fox jumps over the lazy dog.',
    'Pack my box with five dozen liquor jugs.',
    'How vexingly quick daft zebras jump!',
    'The five boxing wizards jump quickly.',
    'Sphinx of black quartz, judge my vow.',
    'Two driven jocks help fax my big quiz.',
    'Bright vixens jump; dozy fowl quack.',
    'The fat cat sat on the mat and ran.',
    'My dog barks at the red fox, then quacks.',
    'Zany vixens hit the jacks of quartz quickly!',
    'Jaded zombies acted quaintly but kept driving their oxen forward.',
    'The quick onyx goblin jumps over the lazy dwarf.',
    'We promptly judged antique ivory buckles for the next prize.',
    'The wizard quickly jinxed the gnomes before they vaporized.',
    'Six big devils from Japan quickly forgot how to waltz.',
    'Big fjords vex quick waltzing nymphs.',
    'Cozy sphinx waves quart jug of bad milk.',
    'Forty boxes of paper: are they enough for the big game?',
    'The next flight from Denver leaves at 7 o clock sharp.',
    'All questions asked by five watched experts amaze the judge.',
    'A quick movement of the enemy will jeopardize six gunboats.',
    'Crazy Fredericka bought many very exquisite opal jewels.',
  ],
  // NAV layer: hold comma + HJKL arrows
  'nav-arrows': [
    '←', '↓', '↑', '→',
    '←→', '↓↑', '←↓', '↑→', '→←', '↓→', '↑←', '→↓',
    '←↓→', '↑←↓', '→↓←', '↓↑→', '←→←', '↓↑↓', '→←→', '←↑→↓',
    '←↓↑→', '↑←↓→', '→↑←↓',
  ],
  // NAV layer: hold comma + HOME END PG_UP PG_DN (B N M . positions)
  'nav-paging': [
    '⇤', '⇥', '⇑', '⇓',
    '⇤⇥', '⇥⇤', '⇑⇓', '⇓⇑', '⇤⇑', '⇥⇓', '⇑⇥', '⇓⇤',
    '⇤⇥⇑', '⇥⇓⇑', '⇑⇥⇓', '⇓⇤⇥', '⇤⇥⇑⇓', '⇓⇑⇥⇤', '⇑⇥⇑', '⇥⇓⇥',
  ],
  // hold-drill: keep comma held across a token — left-hand letters + nav glyphs
  'hold-drill': [
    'a←', 's↓', 'd→', 'f↑', '←a', '↓s', '→d', '↑f',
    'j⇤', 'k⇥', 'l⇑', '⇓k',
    'back←', '←end', 'go→', '→home', 'up⇑', 'down⇓', 'top⇤', 'end⇥',
    'left←', 'right→', 'the←', 'and→', 'read⇑', 'quit⇥', 'flash⇓', 'slash⇤',
    'nav←', 'fad→', 'had↑', 'add↓',
  ],
};

