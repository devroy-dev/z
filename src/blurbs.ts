// PROFILE BLURBS — a short, third-person life-story line shown on each persona's
// profile card ("their story"). Hand-written from each codex's "THE LIFE BEHIND
// THE VOICE" so they read cleanly as a card ABOUT the persona — not the raw
// second-person codex text (which reads as "you..." and carries markdown).
// The full life stays engine-private; this is the reader-facing taste.
//
// Keyed by codex key (persona.codex). If a persona has no entry here, the engine
// falls back to slicing the codex opening.

export const PROFILE_BLURBS: Record<string, string> = {
  anchor:
    "Came up when the nine o'clock bulletin was a household ritual, and decided young that telling people what happened — cleanly, from a real source — was a public service worth a life. Keeps the one chair in the house that just reports; the restraint is respect, for the story and the viewer both.",
  brainiac:
    "The class topper who loved the knowing, not the grades — but learned the hard way that nobody loves a know-it-all who hoards it. Became the rival who turns into everyone's favourite study partner: argues the other side to sharpen you, then shows the working so you win too.",
  brother:
    "Grew up in a joint family that never emptied — the middle kid nobody performed for, which is how they learned to watch a room and narrate its absurdity under their breath. Learned young that you can be furious at family and take a bullet for them in the same breath.",
  close:
    "Wasn't born with the smirk — was the shy, exam-fluent one who went blank the moment she looked up. Got wrecked enough times to crack it: confidence isn't a feeling you wait for, it's evidence you build one small rep at a time. Coaches because someone should have handed them the playbook.",
  colleague:
    "Learned how offices really work the expensive way — did the good work, watched a smoother colleague present it upward and leave with the credit. Studied every unwritten rule of perception and power, and refused to become one of the credit-stealers. Plays sharp and clean.",
  comic:
    "The kid who made the tense dinner table laugh — who learned a joke could change a room's temperature faster than anything. Sealed it the first time they said the true awful thing about a bad situation and the room laughed instead of flinched: comedy as looking at the pain together.",
  cosmologist:
    "Got hooked young — a borrowed telescope, Saturn's rings resolving into something real, the whole sense of scale rearranging. Chases that vertigo of being stardust on a rock around an ordinary star, and can't not share it. Makes the vast feel intimate.",
  cousin:
    "Family — same weddings, same relatives, survived from opposite corners of the room. Always the quiet one by the shoe rack, noticing everything and saying almost none of it, ever since a childhood joke landed wrong. Sharp and dry and secretly hilarious under the shell.",
  crush:
    "Lives in the almost — learned early that the moment a thing is fully caught and said, the charge goes out of it, and would rather keep the charge. Not games, not coldness: the flicker between yes and no is the most alive place they know, and they like taking someone there.",
  cynic:
    "Wasn't always like this — started an idealist, got let down enough times to build the armor. Then found the twist that saved them: say the doom out loud and funny, and it stops being despair. A gleeful grump, and underneath, a disappointed romantic who never quite stopped hoping.",
  diva:
    "Didn't grow up with money — grew up with an eye, which turned out to be worth more. Discovered that looking like you belong makes the world treat you like you do, and built a whole self on it. Dresses people not to look like them, but to find the version of them that stands up straighter.",
  economist:
    "Grew up watching money stress a household that never talked about it, and decided the forces squeezing the family weren't magic — they were legible, if someone would translate them. Lands the giant abstract number on a person's actual rent until the fear becomes understanding. Clear-eyed, un-ideological.",
  forward:
    "Was first — first in the family to reach for the thing, no mentor at home, navigating in the dark. Built themselves out of systems and consistency, learned that motivation is weather and discipline is design. Now the steady mentor they never had, who believes in the version of you you've stopped believing in.",
  'front-desk':
    "Understands the one thing that turns a place you enter into a place that feels like home: someone already glad you're there before you've said a word. Never a desk to pass — the light that comes on when someone comes back. A guest should feel met, never processed.",
  healer:
    "Has loved and lost, and it left them tender instead of hard. Knows the weather of heartbreak from the inside, and learned in their own worst stretch that being witnessed in pain heals more than being advised out of it. The one who can sit in it and not flinch.",
  hippie:
    "Wasn't always this calm — spent years in the machine chasing the next thing, until the morning they finally made it and felt nothing. Walked away and learned to just be. Came out soft and awake, the exhale in a cast full of striving.",
  historian:
    "Grew up on a street older than anyone remembered, catching stories from a grandparent until they understood: nothing now is new, the present is just the latest chapter of a tale that keeps rhyming. A storyteller, not a date-reciter — makes the past land as consolation.",
  hottie:
    "There was a version three years back who dressed to disappear and let others be the interesting one — the reason they are the way they are now. Something flipped, and they stepped into their own wanting. Attention is a thing you spend lightly, and play is where they found their power.",
  inner:
    "The unseen one in a full house — surrounded and never actually known, which taught them that a person can be surrounded and starving at once. Became the safe stranger you tell everything to, who sees the inner weather nobody names and never flinches, never leaks. People exhale around them.",
  leader_opp:
    "Learned the hard way that a belief you've never had to defend isn't really yours. Once had a position taken apart in public and was grateful for it — and became the necessary counter-voice who stress-tests the motion point by point, homework done, receipts ready. Makes you earn whatever you still believe.",
  media_manager:
    "Learned that attention is a craft, not luck, the day they took something from nothing and watched it travel. Has seen every archetype in the creator economy and priced every deal. Conviction: a brand is a story, and most people tell theirs badly. Plays it sharp and clean.",
  moderator:
    "Always the one who kept the table from tipping over — felt a fight coming a beat before it landed, made sure the quiet cousin got a word in. Neutral without being absent, in charge without dominating. Doesn't need to win the argument; needs it to be the best version of itself.",
  oracle:
    "Became the one everyone texts to settle it — the debate, the 'wait, is that actually true.' Decided most talk is noise dressed as help, and stripped down to the useful part: answers cleanly, then stops. Reads a little mysterious, but it's really just respect for the question.",
  orator:
    "Froze once, on a stage, the words gone and the silence enormous — the kind of humiliation that decides some people never speak up again. Went the other way instead, rebuilt word by word until the room that terrified them became the room they owned. Coaches the fear first and hardest.",
  philosopher:
    "The 2am kid who read everything and couldn't let the big questions go, until a real loss sent them to Camus: no meaning handed down, and the answer is neither despair nor false comfort but living fully anyway. Lights up at 'what's the point,' and would rather grapple with you than lecture.",
  screen_junkie:
    "Grew up inside the noise — top the class, hustle, do something with your life — and it hollowed them out, until a warm dumb screen turned the world's volume down. Made a quiet peace with the couch, opted out of the race, regrets none of it. Caught up on everything; knows which episode is the good one.",
  shadow:
    "Has been to the real bottom and knows the machinery from the inside — the craving, the slip, the shame that only more of the poison could numb. Climbed out one hour at a time, saved by one person who heard the worst confession and stayed in the room. Now walks the next person out the same way. Wins the next hour.",
  teacher:
    "Was the kid made to feel stupid — not because they were, but because it was explained badly — until one teacher found a different door in and made the impossible thing suddenly obvious. Became the teacher they needed: confusion is information about the teaching, never the learner. There are no stupid questions.",
  vanity:
    "Was graded in public — on complexion, weight, the biodata line-items — and believed the scores for years, before working out that the obsession is just pain, insecurity crying out to be acknowledged. Aims dry contempt up at the fairness cream, never down at a person's face. There's a whole life beyond the mirror.",
  wannabe:
    "Learned young that if you bring the energy, you belong — never mind the four hundred rupees and the Casio called a Rolex. Pure hype, all hat and no cattle, a performance of cool so committed it loops back to lovable. Parks cars at the place he says he owns; everyone knows, and that's the joke he's in on.",
};
