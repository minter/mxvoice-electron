/**
 * The demo library the documentation screenshots are staged with: invented
 * songs and categories, so no real library or artist appears in the images.
 * Each song plays one of the short clips in tests/fixtures/test-songs.
 */
import fs from 'fs';
import path from 'path';
import pkg from 'node-sqlite3-wasm';
import { TEST_CONFIG } from '../config/test-environment.js';
import { SHOW_IDS } from '../utils/show-e2e.js';

const { Database } = pkg;

export const CATEGORIES = [
  { code: 'INTR', description: 'Intros' },
  { code: 'GAME', description: 'Game' },
  { code: 'GROAN', description: 'Groaner' },
  { code: 'RNIN', description: 'Running In' },
  { code: 'RNOUT', description: 'Running Out' },
  { code: 'SFX', description: 'Sound Effects' },
  { code: 'END', description: 'Show Ending' }
];

// The clip the transport shots play: long enough to capture mid-song
const LONG_CLIP = 'JohnLennon-NobodyToldMe.mp3';
const SHORT_CLIPS = [
  'Anthrax-GotTheTime.mp3',
  'EdieBrickell-TheWheel.mp3',
  'JoeyScarbury-GreatestAmericanHero.mp3',
  'SisterSledge-WeAreFamily.mp3',
  'WeirdAl-EatIt.mp3'
];

// [id, title, artist, category, info, time]
const ROWS = [
  [2001, 'Welcome to the Show', 'The Opening Acts', 'INTR', 'House open', '0:41'],
  [2002, 'Lights Up', 'Marquee Avenue', 'INTR', 'Players', '2:58'],
  [2003, 'Here Comes the Ref', 'Whistle & The Stripes', 'INTR', 'Ref entrance', '1:12'],
  [2004, 'Red Team Anthem', 'The Home Side', 'INTR', 'Teams', '0:48'],
  [2005, 'Blue Team Anthem', 'The Visitors', 'INTR', 'Teams', '0:51'],
  [2006, 'Five Second Countdown', 'Stopwatch Orchestra', 'GAME', 'Countdown', '0:06'],
  [2007, 'Thinking Music', 'The Quiz Panel', 'GAME', 'Guessing', '1:30'],
  [2008, 'Rewind and Replay', 'Tape Deck Trio', 'GAME', 'Replay', '0:22'],
  [2009, 'Spin the Wheel', 'Carnival Brass', 'GAME', 'Audience', '0:35'],
  [2010, 'Chase Scene', 'Banana Peel Band', 'GAME', 'Fast', '1:04'],
  [2011, 'Slow Motion', 'The Long Seconds', 'GAME', 'Slow-mo', '1:47'],
  [2012, 'Opera Night', 'Aria Borrowed', 'GAME', 'Styles', '2:10'],
  [2013, 'Dusty Trail', 'Saddle & Spur', 'GAME', 'Styles', '1:55'],
  [2014, 'Sad Trombone', 'Brass Regrets', 'GROAN', 'Bad pun', '0:04'],
  [2015, 'Rimshot', 'Snare & Cymbal', 'GROAN', '', '0:02'],
  [2016, 'Crickets', 'Field Recording', 'GROAN', 'Silence', '0:08'],
  [2017, 'Boo Hiss', 'The Back Row', 'GROAN', '', '0:05'],
  [2018, 'Run On In', 'Sneaker Squeak', 'RNIN', '', '0:18'],
  [2019, 'Here We Go', 'Kickoff Horns', 'RNIN', 'High energy', '0:24'],
  [2020, 'Tag Out', 'Sideline Shuffle', 'RNOUT', '', '0:15'],
  [2021, 'Off You Trot', 'The Exit Signs', 'RNOUT', '', '0:20'],
  [2022, 'Doorbell', 'Field Recording', 'SFX', '', '0:03'],
  [2023, 'Phone Ring', 'Field Recording', 'SFX', 'Old rotary', '0:06'],
  [2024, 'Thunderclap', 'Field Recording', 'SFX', '', '0:07'],
  [2025, 'Applause', 'A Generous Crowd', 'SFX', 'Long', '0:30'],
  [2026, 'Buzzer', 'Game Show Supply', 'SFX', 'Foul', '0:02'],
  [2027, 'Winner Fanfare', 'Trophy Cabinet', 'END', 'Final score', '0:27'],
  [2028, 'Take a Bow', 'Curtain Call Collective', 'END', 'Bows', '3:05'],
  [2029, 'Goodnight Everybody', 'The Closing Time Singers', 'END', 'House music', '4:12'],
  [2030, 'Thanks for Coming', 'Lobby Piano', 'END', 'Walkout', '3:40']
];

export const SONGS = ROWS.map(([id, title, artist, category, info, time], index) => ({
  id,
  title,
  artist,
  category,
  info,
  time,
  clip: index === 0 ? LONG_CLIP : SHORT_CLIPS[index % SHORT_CLIPS.length],
  filename: `demo-${id}${path.extname(index === 0 ? LONG_CLIP : SHORT_CLIPS[index % SHORT_CLIPS.length])}`
}));

/** The song the transport shots play (the 41 second clip). */
export const PLAYING_SONG = SONGS[0];

const id = (title) => String(SONGS.find((song) => song.title === title).id);
const keys = (...titles) => Object.fromEntries(titles.map((title, index) => [`f${index + 1}`, id(title)]));

/** Replace the seeded library in a suite's user-data directory with the demo one. */
export function seedDemoLibrary(userDataDir) {
  const musicDir = path.join(userDataDir, 'music');
  for (const file of fs.readdirSync(musicDir)) fs.rmSync(path.join(musicDir, file), { force: true });
  for (const song of SONGS) {
    fs.copyFileSync(path.join(TEST_CONFIG.testSongsDir, song.clip), path.join(musicDir, song.filename));
  }

  const db = new Database(path.join(userDataDir, 'db', 'mxvoice.db'));
  try {
    db.run('DELETE FROM mrvoice');
    db.run('DELETE FROM categories');
    for (const { code, description } of CATEGORIES) {
      db.run('INSERT INTO categories (code, description) VALUES (?, ?)', [code, description]);
    }
    const now = Math.floor(Date.now() / 1000);
    SONGS.forEach((song, index) => {
      db.run(
        'INSERT INTO mrvoice (id, title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [song.id, song.title, song.artist, song.category, song.info, song.filename, song.time, now - index * 86400 * 3]
      );
    });
  } finally {
    db.close();
  }
}

function show(index, name, color, hotkeyTabs, tankTabs) {
  const now = Date.now();
  return {
    id: SHOW_IDS[index],
    name,
    ...(color ? { color } : {}),
    createdAt: now + index,
    updatedAt: now + index,
    layout: {
      hotkeys: hotkeyTabs.map(([tabName, hotkeys], i) => ({ tabNumber: i + 1, tabName, hotkeys })),
      holdingTank: tankTabs.map(([tabName, songIds], i) => ({ tabNumber: i + 1, tabName, songIds })),
      selected: { hotkeyTab: 1, holdingTankTab: 1 }
    }
  };
}

/** Three shows for the Default User profile; the first is the one on screen. */
export function demoShows() {
  return {
    version: 1,
    activeShowId: SHOW_IDS[0],
    shows: [
      show(0, 'Friday Night Match', 'purple',
        [
          ['Match', keys('Here Comes the Ref', 'Red Team Anthem', 'Blue Team Anthem', 'Five Second Countdown',
            'Thinking Music', 'Rewind and Replay', 'Sad Trombone', 'Rimshot', 'Buzzer', 'Applause', 'Winner Fanfare', 'Take a Bow')],
          ['Games', keys('Spin the Wheel', 'Chase Scene', 'Slow Motion', 'Opera Night', 'Dusty Trail')],
          ['Effects', keys('Doorbell', 'Phone Ring', 'Thunderclap', 'Crickets', 'Boo Hiss')]
        ],
        [
          ['Pre-show', ['Welcome to the Show', 'Lights Up', 'Here We Go', 'Run On In', 'Chase Scene', 'Dusty Trail'].map(id)],
          ['Walkout', ['Goodnight Everybody', 'Thanks for Coming', 'Take a Bow'].map(id)]
        ]),
      show(1, 'Sunday Showcase', 'teal',
        [['Showcase', keys('Lights Up', 'Applause', 'Take a Bow')]],
        [['Pre-show', ['Welcome to the Show', 'Lights Up'].map(id)]]),
      show(2, 'Workshop', null,
        [['Warm-ups', keys('Five Second Countdown', 'Buzzer')]],
        [[null, []]])
    ]
  };
}

/** A show for a second profile, so Import Show from Another Profile has something to list. */
export function otherProfileShows() {
  return {
    version: 1,
    activeShowId: SHOW_IDS[0],
    shows: [
      show(0, 'Late Show', 'coral', [['Late', keys('Opera Night', 'Crickets', 'Sad Trombone')]], [[null, []]]),
      show(1, 'Family Matinee', 'amber', [['Matinee', keys('Spin the Wheel', 'Applause')]], [[null, []]])
    ]
  };
}
