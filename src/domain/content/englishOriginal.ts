import type { Passage } from './passages'

const short = [
  [
    'en-library',
    'The Quiet Library',
    'A small journey among books.',
    [
      'A small light waits by the window.',
      'I open a book and listen to the rain.',
      'Every page gives a quiet thought a place to rest.',
      'The clock moves on, but there is no need to hurry.',
      'Before I leave, I write one sentence in my notebook.',
      'Tomorrow, I will return to the same warm light.',
    ],
  ],
  [
    'en-first-light',
    'Before the First Train',
    'Notice a city waking up.',
    [
      'The first train has not arrived yet.',
      'A baker lifts the shutters across the street.',
      'Two birds hop along the empty platform.',
      'I take a slow breath and put my phone away.',
      'For a moment, the whole city seems to begin again.',
      'When the doors open, I am ready to go.',
    ],
  ],
  [
    'en-small-lab',
    'Notes from a Small Lab',
    'Observe, question, and try again.',
    [
      'We start with a question, not an answer.',
      'The sample is small, so we measure it twice.',
      'Write down what you see before you explain it.',
      'An unexpected result can be a useful beginning.',
      '"Try again," she says, "but change only one thing."',
      'We leave the bench clean for the next experiment.',
    ],
  ],
  [
    'en-after-rain',
    'A Walk after Rain',
    'Find a little room in an ordinary day.',
    [
      'The rain stops just before sunset.',
      'A narrow path leads from my house to the river.',
      'There are tiny circles of light in every puddle.',
      'I do not count my steps or plan tomorrow.',
      'At the bridge, I stop to watch the water.',
      'The way home feels a little shorter tonight.',
    ],
  ],
] as const

const long = [
  [
    'en-long-observatory',
    'The Observatory at Dawn',
    'A complete story, without a change of prompt.',
    'When Mara reached the observatory, the valley was still dark. The last bus had left her at a bend in the road, and she had walked the final mile with a notebook in her coat pocket. Above the trees, a thin line of cloud moved across the stars. She had come to help repair an old telescope, but for a few minutes she simply stood at the gate and looked up.\n\nInside, a kettle was already boiling. Daniel, the caretaker, set two cups on the table and showed her a box of carefully labeled parts. Some were new. Others had been made by people who no longer worked there. Each label carried a date, a short description, and sometimes a small drawing. "The drawings help," he said. "A good note is a kind of conversation with the next person."\n\nThey worked slowly. Mara held a lamp while Daniel checked the loose connection beneath the mount. Then they exchanged places, and she adjusted the cable while he read the instructions aloud. Once, they thought the problem was solved, only to find that the same small error appeared again. Neither of them reached for a dramatic explanation. They wrote down what had changed and tested one thing at a time.\n\nBy four in the morning, the telescope was moving smoothly. The screen showed a faint cluster of stars, scattered like seeds across a dark field. Mara remembered seeing the same cluster as a child through a much smaller instrument. She had expected a bright picture then and had been disappointed by the pale shapes. Now she understood how much patient work was hidden in those quiet points of light.\n\nBefore dawn, they opened the eastern door. The valley was turning blue, and the outlines of the houses had begun to separate from the hillside. A delivery truck moved along the road below. Somewhere a dog barked. The stars had not gone anywhere, Mara thought. The daylight had simply made them harder to see.\n\nShe wrote one last note before closing her notebook: the connection is secure, the test is repeatable, and the kettle needs more water. Daniel laughed when he read it. They left the equipment ready for the evening team and walked down to the gate together. The work was finished for now, but the conversation would continue the next time someone opened the book.',
  ],
  [
    'en-long-workshop',
    'The Workshop beside the River',
    'Follow one continuous piece of English prose.',
    'The workshop stood between a bicycle shop and a narrow lane that led to the river. Its front window was filled with wooden bowls, small boxes, and a chair that was never for sale. On Saturday mornings, people brought in things they hoped could be repaired. A loose handle, a broken drawer, or a table with one short leg could all begin a conversation.\n\nNora arrived with a box her grandfather had made. The lid did not close, and one corner had started to come apart. She expected the owner to take it behind the counter and tell her when to return. Instead, he cleared a space on the bench. "You can help if you have an hour," he said. She took off her coat and placed it on the chair by the window.\n\nFirst they looked at the box without touching it. The owner asked where it had been kept, when the lid had stopped closing, and whether the room was warm or damp. Nora did not know every answer. That was all right. They wrote down what they knew and left the other questions open. Then he showed her how to feel the grain of the wood with the side of her hand.\n\nThe repair was smaller than she had imagined. They cleaned an old joint, checked the fit, and added a careful line of glue. A clamp held the corner while they worked on the lid. Nothing was rushed, but there was always something to do. Between tasks, the owner explained why a tool was shaped a certain way, or why it was better to remove a little material twice than too much at once.\n\nWhile the glue dried, they walked to the river. The path was busy with runners and people carrying shopping bags. Nora told him about the letters she kept in the box. Some were from her grandfather, and some were letters she had written but never sent. He listened without asking to read them. "Then it is a useful box," he said, and they watched a leaf turn slowly in the current.\n\nBack in the workshop, the lid closed with a soft, even sound. The repaired corner was still visible if you knew where to look. Nora was glad of that. She had not wanted the box to become a different object. She wanted it to keep doing what it had always done, with enough care to last a little longer. She carried it home with both hands, noticing for the first time how neatly it had been made.',
  ],
] as const

export const englishOriginalPassages: Passage[] = [
  ...short.map(([id, title, subtitle, lines], i) => ({
    id,
    title,
    subtitle,
    genre: 'オリジナル',
    accent: `EN${i + 1}`,
    language: 'en' as const,
    paragraphs: lines.map((text) => ({ text, reading: text })),
  })),
  ...long.map(([id, title, subtitle, text], i) => ({
    id,
    title,
    subtitle,
    genre: 'オリジナル長文',
    accent: `EL${i + 1}`,
    language: 'en' as const,
    continuous: true,
    paragraphs: [
      { text: text.replace(/\n\n/g, ' '), reading: text.replace(/\n\n/g, ' ') },
    ],
  })),
]
