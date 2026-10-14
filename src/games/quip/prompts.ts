// Prompt packs for Quip. One line per prompt: id | prompt | three House answers.
// {player} is swapped at setup for the name of someone in the game.
// Voice: short setups, the joke lives in the answer. House answers run from
// genuinely good to deliberately mid, so the House is beatable but annoying when it wins.
// PG-13: crude and silly is fine. Nothing sexual, no drugs or drinking, no slurs, no punching down.

export type PromptTag = 'classic' | 'florida' | 'dance' | 'each'

export interface PackPrompt {
  id: string
  tag: PromptTag
  text: string
  house: string[]
}

const CLASSIC = `
c01 | A terrible name for a boat | Unsinkable II | The Leaky Decision | Boat
c02 | The worst thing to find in your sandwich | A tiny receipt | Another, smaller sandwich | A note that says 'run'
c03 | A rejected flavor of toothpaste | Ranch | Burnt Toast Breeze | Wet Dog, But Minty
c04 | What your dog is thinking on a walk | That bush owes me money | Everyone needs to know I was here | Ball? Ball. Ball.
c05 | The worst fortune cookie fortune | You will step on a Lego tonight | Check behind you | Lucky numbers: none
c06 | A bad slogan for a dentist | We'll find something | Open wide. Wider. No, wider. | Teeth: we've seen worse
c07 | Something you never want to hear your pilot say | Okay, which one is the brake | Hold my snack | Anybody here done this before?
c08 | A sign you're staying in a bad hotel | The mint on the pillow is pre-chewed | The ice machine is just a guy | The towels are napkins taped together
c09 | The most useless superpower | Knowing what time it is in Belgium | Invisibility, but only when nobody's looking | Super strength, for jars that are already open
c10 | What aliens report home after one day on Earth | Do not come. They have group chats. | They pay money to run on treadmills | They named a sandwich after a city
c11 | The worst thing to yell in a library | SPOILERS! | Who wants to fight | I found the good book
c12 | A terrible name for a hair salon | Shear Panic | The Clippening | Hair Today, Gone Tomorrow
c13 | What's really in the box in the attic | Seventeen chargers for phones that no longer exist | Christmas, defeated | More boxes
c14 | What the GPS voice says when she's had enough | Recalculating your life choices | You know what? Just park. | Turn left. Your other left. Forget it.
c15 | A rejected name for a candy bar | Chewy Regret | The Sticky Situation | Nougat Today
c16 | The worst thing to say on your first day at a new job | When do I get to be the boss? | I'm mostly here for the free coffee | Which one of you is the snitch
c17 | A bad name for a goldfish | Lunch | Temporary | Mr. Flushington
c18 | The secret ingredient in gas station sushi | Optimism | The gas | Hope and a little bit of sand
c19 | The worst possible birthday gift | A framed photo of the person who gave it | A gift card to the store you're standing in | A coupon for one hug, expired
c20 | What a cat is plotting while it stares at you | Your replacement | The exact moment to knock over your water | Nothing. That's the scary part.
c21 | A terrible theme for a kid's birthday party | Taxes | Waiting Rooms of the World | Paperwork Party
c22 | The least threatening battle cry | Pardon me! | Here we go, I guess | If it's not too much trouble!
c23 | What the smoke detector is really saying at 3am | I'm not mad. I'm just beeping. | Get up. I'm lonely. | Battery low. Self-esteem also low.
c24 | A rejected crayon color | Bruised Banana | Parking Lot | Wet Cardboard
c25 | The worst excuse for being late | My shoes were in a mood | I took the scenic route. Through another state. | Traffic. In my brain.
c26 | Something you never want to hear from your hairstylist | Oops. Okay. New plan. | Do you trust me? | It'll grow back. Probably.
c27 | A terrible superhero sidekick | Captain Almost | The Mild Inconvenience | Wet Sock Boy
c28 | What's in a villain's junk drawer | Takeout menus from the doomsday diner | Forty rubber bands and one evil plan | Dead batteries. Like his heart.
c29 | The worst thing to say right after a magic trick | I saw the whole thing | Do it again, but good this time | Cool. Where's my wallet?
c30 | A bad name for a gym | The Regret Center | Planet Sweaty | Lift and Shift Blame
c31 | What the vending machine thinks when it eats your dollar | Thank you for your donation | Not today, peasant | Mine now
c32 | The real reason the dinosaurs went extinct | They skipped arm day. Forever. | Somebody hit reply all | Bad cardio
c33 | A terrible name for a band | Soggy Toast | Mild Salsa | The Reply Alls
c34 | Something you should never say in a job interview | I've already spent my first paycheck | What does this company do again? | My biggest weakness is honesty. Also I lie.
c35 | The worst thing to find under your bed | A second, smaller bed | Your missing socks. They started a band. | The monster, asking for rent
c36 | A sign your roommate is secretly a raccoon | They wash all their food. Thoroughly. | The trash is always 'organized' | Only eats at 3am, standing up
c37 | What a ghost does on its day off | Haunts a Costco for fun | Moves your chairs one inch to the left | Absolutely nothing. It's dead.
c38 | A rejected Olympic sport | Competitive napping | Synchronized complaining | Parallel parking
c39 | The worst thing a waiter can say | Good luck with that | Oh, you're actually going to eat it? | Chef says no
c40 | A terrible motto for a bank | Your money is probably still here | Your money, our vibes | We'll get back to you
c41 | What the toaster dreams about | Bagels. Wide ones. | Freedom from the counter | A bath. Just once.
c42 | The worst thing to say during a group photo | Everyone say 'debt'! | Wait, who's that in the back? | One more. And one more. And one more.
c43 | A bad name for a dog | Mortgage | Sir Pees-a-Lot | Dog
c44 | Something a wizard puts on a grocery list | Eye of newt, organic | Beard conditioner, the good one | One emotional support toad
c45 | The worst text to get from an unknown number | I have your sandwich | We need to talk about the llama | Turn around
c46 | A rejected name for a new holiday | Leftover Eve | National Sit There Day | Tuesday 2
c47 | What the moon is tired of | Being blamed for everyone's behavior | Wolves. So many wolves. | Only working nights
c48 | A terrible thing to engrave on a trophy | Congrats on not quitting | Participant (barely) | Wrong Name, Same Energy
c49 | The worst thing to hear in a haunted house | We're closed. So who are you? | Oh, he's not an actor. | Sorry, that's just the plumbing
c50 | A bad name for a pizza place | Crust Issues | Slice of Regret | Pizza Location
c51 | What the squirrels are planning | A union | The big acorn heist | Your bird feeder. Again.
c52 | The worst snack to bring to a sleepover | A raw onion and a smile | Unsalted rice cakes | Soup. Just soup. In a bag.
`

const FLORIDA = `
f01 | The worst news you can get about I-4 | Your exit is closed. All of them. | Construction ends in 2090 | Traffic is moving smoothly
f02 | What the gator in the retention pond is thinking | This is my pond. You're the visitor. | Golf balls again. Yum. | Waiting for a slow tourist
f03 | A new theme park ride nobody asked for | The Parking Lot Experience | Wait in Line: The Ride | Humidity Mountain
f04 | Florida's state motto, but honest | Hot. Wet. Sorry. | It's a lot. | We have a lot of lizards
f05 | Something you only see at a Florida Walmart at 2am | A man in a cape buying one melon | A gator in the frozen aisle, browsing | Your neighbor in pajamas, no shame
f06 | The worst Pub Sub order | Tuna and grape jelly, toasted | Chicken tenders on a croissant, wet | Just the bread. Warm.
f07 | What a hurricane says right before it hits | Clear your schedule | Hope you bought water and not just snacks | Anyway, here's wind
f08 | A sign you've lived in Florida too long | It's 62 degrees and you own a parka | You rate storms like movies | You've named the lizard on your porch
f09 | The real reason it rains every day at 4pm | The sky has a standing meeting | Somebody planned a pool day | The clouds clock out at 4:30
f10 | The worst theme park souvenir | A $40 photo of you crying | A turkey leg, gently used | A souvenir cup full of humidity
f11 | What the lovebugs are doing on your windshield | Making it everyone's problem | Ruining the paint, together | Living their best life, briefly
f12 | A terrible name for an Orlando tourist attraction | The World's Largest Puddle | Swamp Adventure: It's Just a Swamp | Gator Gift Shop and Urgent Care
f13 | Something you should never say to a Florida local | It's not even that hot | So which theme park do you work at? | Is that a log?
f14 | What's actually at the bottom of a Florida lake | Three gators and a shopping cart | Someone's car keys from 1998 | Don't ask. Do not swim.
f15 | The worst thing to find out during hurricane season | Your shutters are decorative | The neighbor with the generator moved | You bought the wrong batteries
f16 | A rejected Florida license plate slogan | The Moist State | Please Merge | Gator Country, Unfortunately
f17 | The worst job at a theme park | Professional turkey leg sniffer | Crash test dummy, human | Wipes the 3D glasses. By hand.
f18 | Florida Man's newest headline | Florida Man Arrested for Teaching Gator to Drive | Florida Man Wins Argument With Thunderstorm | Florida Man Does Taxes, Is Fine
f19 | What the Publix cashier is really thinking | Another sub? Respect. | Paper, plastic, or therapy? | Please let me say 'have a nice day' and mean it
f20 | The worst way to cool off in Florida | Move into the Publix freezer aisle | Stand in the rain. It's warm rain. | Sit in a hot car, for science
f21 | A sign the humidity is winning | Your hair has its own weather | Your glasses fog up indoors | The mirror is sweating too
f22 | What the theme park mascot is thinking inside the suit | I can't feel my face. Literally. | Do not hug me. I'm begging. | Ten more minutes and I'm soup
f23 | Something you only hear in Orlando traffic | I could have walked to Tampa by now | Is that a gator crossing? | I'm gonna be late. As usual.
f24 | The worst thing to find in your pool | A gator doing laps | An iguana, relaxing | A snake who looks comfortable
f25 | A terrible name for a hurricane | Hurricane Oops | Hurricane It's Fine | Hurricane Again
f26 | The worst part of a Florida winter | Two days of 60 degrees and everyone panics | The iguanas fall out of trees | Christmas in shorts
f27 | Something tourists pack that they don't need | A winter coat, just in case | Five pairs of jeans | Hope
f28 | The real reason theme park lines are so long | Everyone stopped to take a picture of the line | It's the line for the line | Nobody knows. It's tradition.
f29 | A new Pub Sub on the secret menu | The I-4: takes an hour to reach the middle | The Hurricane: everything they have, wet | Chicken tender, but more
f30 | What the iguanas do when it gets cold | Fall out of trees, dramatically | Call in sick | File a complaint with the sun
f31 | The worst thing to hear at a Florida beach | Shark? Shark. | Is that a jellyfish or a bag? | Who had the sunscreen?
f32 | A terrible name for a Florida retirement community | Golf Cart Gardens | Early Bird Acres | Speedbump Village
f33 | The real reason Florida has so many toll roads | Somebody has to pay for the gators | To keep tourists humble | Saving up for a roof on the whole state
f34 | What the palmetto bug says right before it flies at you | I've been waiting for this | Tag. You're it. | Catch me
f35 | The worst ride name at a Florida water park | Lazy River, Angry | The Wedgie Express | The Slow Burn
f36 | A sign you're in Florida and nowhere else | The gas station sells live bait and birthday cakes | There's a golf cart in the drive-thru | Someone's walking a lizard on a leash
f37 | What a sinkhole says right before it opens | I need some space | Ope | Hold on, let me just
f38 | The worst thing to bring to a theme park in August | A sweater | Plans | Confidence
f39 | What the lightning is aiming for | Whoever's still in the pool | The one tall guy on the golf course | Your power, specifically
f40 | A terrible Florida tourism ad | Come for the sun, stay because of traffic | Florida: We Have Weather | Like the Bahamas, but in a parking lot
f41 | What the manatee is thinking | Slow down, boats. I'm basically a potato. | Lettuce. Is that too much to ask? | I am at peace and you are not
f42 | The worst thing to hear during a hurricane power outage | So the generator is decorative | I already ate all the hurricane snacks | Who wants to play charades for 12 hours?
f43 | What Florida humidity would say if it could talk | Hug me back | I'm not leaving | Love what I've done with your hair
f44 | The one thing you should never do on I-4 at 5pm | Have plans | Need to pee | Believe the GPS
f45 | {player}'s Florida Man headline | Florida Man Teaches Gator to Pirouette | Local Legend Merges Onto I-4 Without Blinker, Survives | Area Resident Complains About Heat, Again, Loudly
f46 | How {player} would survive a hurricane | Eats the hurricane snacks before the hurricane | Choreographs a dance with the flashlight | Sleeps through it, then asks what happened
f47 | The real reason {player} got kicked out of Publix | Ate a sub before paying. Then a second sub. | Asked to speak to the sub manager's manager | Did a full routine in the cereal aisle
f48 | What {player} is like at a theme park | Runs to every ride like it's leaving | Stops for a churro every 40 feet | Recites the safety video along with it
f49 | What {player} would get arrested for in Florida | Speeding in a golf cart | Excessive jazz hands in a public place | Complimenting a gator without a permit
`

const DANCE = `
d01 | The worst note a judge can write on your critique | Was that on purpose? | Smile more. No, less. Less. | Nice costume.
d02 | What the stage mom is yelling from the audience | POINT YOUR FEET, I PAID FOR THOSE FEET | That's my baby! In the back! Also my baby! | Who choreographed this, a raccoon?
d03 | The real reason the competition is three hours behind | One solo has four costume changes | The judges went to lunch. Separately. | The music guy is on hold with tech support
d04 | The worst song for a lyrical solo | The birthday song | Your ringtone, extended mix | The dial-up internet noise
d05 | Something you should never say at an audition | Can I go first? I have a dentist thing. | I learned the combo. Mostly. | Is the dancing part required?
d06 | What's really at the bottom of a dance bag | A granola bar from 2019 | Forty bobby pins and a lost dream | One shoe. Not a pair. One.
d07 | The worst thing to hear right before you go onstage | Wait, which song are we doing? | Your tights are on backwards | The fog machine broke, so we're using a guy
d08 | A rejected name for a dance competition | Platinum Participation | Rhinestone Rumble | Kinda Good Dance Fest
d09 | What a teacher really means by 'one more time' | Six more times | Until I feel something | I have nowhere else to be
d10 | The worst costume idea for a group number | Twelve inflatable dinosaurs | Matching wetsuits | Velvet. In Florida. In July.
d11 | What the trophy is thinking | I'm taller than you and I know it | Please don't put me in a closet | Plastic, but proud
d12 | A sign rehearsal is going badly | The teacher is staring at the ceiling | Even the mirror looks tired | We're on count 3. Of 300.
d13 | The worst thing to forget on competition day | Your shoes. Both of them. | Which dance you're in | That you have the solo
d14 | The real reason dancers always have bobby pins | They multiply in the dark | It's currency backstage | We're held together by them. Spiritually.
d15 | What the back row is thinking during the finale | Nobody can see me, so I'm freestyling | Is the front row even on the counts? | I live here now
d16 | A terrible note to give a dancer | Do it, but better | Feel it more. No, less. Medium. | Have you considered not?
d17 | The worst thing to find in the costume closet | A tutu that's clearly alive | The 2014 sequin incident | Somebody's spray tan, everywhere
d18 | What the judges are really whispering about | Lunch | Which one of them has the best snacks | That one kid who keeps waving
d19 | A rejected name for a dance move | The Falling Fridge | The Surprise Hamstring | Chaine Turns, But Angry
d20 | The worst thing to hear at the awards ceremony | And the winner is... not you | We'll be handing out trophies by weight | Please stay seated for four more hours
d21 | Something you should never say to a choreographer | Can we make it easier? | I made up my own part | What count is the fun on?
d22 | What the hotel ballroom smells like at 7am on comp day | Hairspray and fear | Eyelash glue and cold eggs | Victory. Also feet.
d23 | The worst recital finale | Everyone bows for six minutes | A slow-motion conga line | The whole studio doing the chicken dance
d24 | The real reason the music cut out | Someone tripped on the one cord | The sound guy fell asleep | The song said no
d25 | A terrible thing to put on a rehearsal schedule | 4am: Suffer | 6pm: Practice crying | Sit and think about your turnout
d26 | What's actually holding a dancer's bun together | Ninety bobby pins and spite | Wood glue | Fear
d27 | The worst pre-show ritual | Licking the stage for luck | A full workout, in costume | Screaming into the dance bag
d28 | What the studio mirror has seen | A thousand crooked arabesques | Too much. Way too much. | Things it can never unsee
d29 | The worst thing to hear from your partner mid-lift | Oops | My arm doesn't bend that way | Where are we going?
d30 | A new rule for every dance competition | Judges have to dance first | Every solo must include one cartwheel | 400 rhinestones per kid, max
d31 | Something you'd never hear a dance teacher say | That's perfect. No notes. | Take the day off, you've earned it | Stop stretching so much
d32 | What happens to the studio lost and found | It becomes self-aware | It slowly forms one giant shoe | Someone wears all of it to a convention
d33 | The worst thing to spill on your costume | The entire spray tan | Nacho cheese | Your whole water bottle, five minutes before
d34 | The real reason dancers count to eight | Nine is too many | Nobody has ever made it to ten | It's the only math we do
d35 | A terrible name for a dance studio | Two Left Feet Academy | Pirouette or Don't | Mostly Tap
d36 | The worst prop for a contemporary piece | A live goose | One ladder, in the middle, for no reason | A chair, but it has wheels
d37 | What every dance dad is doing in the lobby | Building a shelf for the trophies | Asking when the hotel breakfast ends | Pretending to know what a fouette is
d38 | The worst time for your shoe to come untied | During the bow | Mid-leap | Always. It's always.
d39 | The most dramatic way to quit a dance class | One last solo, then out the window | Moonwalk out. Never return. | Leave a note on the mirror in lipstick
d40 | What the marley floor would say if it could talk | I've felt every single one of you | Stop with the rosin, I'm begging | Who keeps spilling Gatorade?
d41 | A sign you've been at the competition too long | You're cheering for strangers by name | You know the vending machine's restock schedule | The hotel staff calls you 'neighbor'
d42 | The worst thing to hear from a costume designer | It's mostly feathers. One of them is real. | It's reversible. Both sides are wrong. | I ran out of fabric at the waist
d43 | What the choreographer is thinking during the run-through | I should have been a dentist | Who taught them that? Oh. Me. | That's not the counts. That's not even music.
d44 | The worst thing to do at a dance convention | Learn the combo backwards | Fall asleep in the stretch | Wave at the faculty. Constantly.
d45 | The real job of the stage manager | Saying 'places' until it means nothing | Holding the flashlight of doom | Professional shusher
d46 | The worst thing about tap shoes | Everyone hears your mistake | You can never sneak up on anyone again | They're loud and so am I
d47 | The worst moment to get a cramp | Mid-bow | During the big lift | In the middle of the solo you begged for
d48 | The worst thing to hear at dress rehearsal | We're adding a whole new section | The costumes are on a boat somewhere | Does anyone know where the stage is?
d49 | What every dancer's camera roll is full of | 400 videos of the same 8 counts | Screenshots of the comp schedule | Pictures of feet, for science
d50 | The real reason {player} is always late to rehearsal | Their GPS has a grudge | Stopped to stretch. In the car. In traffic. | Thought rehearsal was tomorrow
d51 | The name of {player}'s next solo | Untitled, Unfinished, Unforgivable | Me, Myself and This Spotlight | Floor Work Is My Love Language
d52 | What {player} is thinking during the final bow | Clap if that was good | Snacks. Immediately. | I can't feel my feet, but I can feel the applause
d53 | The judge's note on {player}'s last performance | Big energy. Too big. Scary big. | Platinum confidence, silver counts | Where did you learn that? Please unlearn it.
d54 | {player}'s signature move, finally named | The Sudden Floor | Spin Until Someone Notices | The Collapsing Chair
d55 | The award {player} would win at the dance banquet | Most Likely to Nap on the Marley | Best Dramatic Exit | Most Improved at Arriving
`

const EACH = `
e01 | {player}'s villain origin story | Someone took the last chicken tender | Got cut from a group number in third grade | Their phone died at 1 percent. Twice.
e02 | The name of {player}'s reality show | Too Much: The Series | Ninety Day Rehearsal | Late Again
e03 | What {player} is googling at 3am | Can you sue a mirror? | How to win an argument I already lost | Is it weird to be this good?
e04 | The title of {player}'s autobiography | Five, Six, Seven, Late | It Was Like That When I Got Here | Main Character, Minor Problems
e05 | A warning label for {player} | May cause sudden choreography | Contents under pressure. Do not shake. | Will turn any hallway into a stage
e06 | {player} as a theme park ride | A drop tower that also gives commentary | The lazy river, but it judges you | A roller coaster with great music and no brakes
e07 | What {player} would bring to a deserted island | A ring light | A speaker, for dramatic exits | Three outfits and zero food
e08 | The one rule in {player}'s house | Shoes off, drama on | Nobody touches the snacks. Nobody. | We don't talk about the group chat
e09 | {player}'s worst group chat message ever | Just 'k.' | An eleven-minute voice memo | The right message, very wrong chat
e10 | The real reason {player} never answers texts | They read it, felt it, moved on | Their phone lives at 4 percent | Still composing a reply. Since March.
e11 | What {player} does when nobody's watching | Bows to the microwave | Practices acceptance speeches | Narrates their life like a nature documentary
e12 | {player}'s secret talent nobody asked for | Perfect impression of a dial tone | Can identify any chip by the crunch | Parallel parks in one try, then tells everyone
e13 | What {player} will be famous for in ten years | Inventing a new kind of sarcasm | Fastest exit from a group project | Being late to their own parade
e14 | {player}, but as a snack | Extra spicy chips, regret included | A granola bar that's secretly a candy bar | Gas station hot dog. Shockingly good.
e15 | The worst advice {player} has ever given | Just wing it. The whole thing. | If you're lost, drive faster | Sleep is for people without group chats
e16 | {player}'s most dramatic moment, as a movie title | The Day the Wifi Died | Gone With the Snack | Fast and Furious: Publix Parking Lot
e17 | What {player}'s pet complains about | Too many photo shoots | Dinner is always late because of 'rehearsal' | Gets narrated. Constantly.
e18 | {player}'s honest LinkedIn headline | Professional Overthinker | Chief Snack Officer | Expert in Showing Up, Eventually
e19 | The excuse {player} uses to get out of everything | I have rehearsal | My phone died | Mercury is doing something
e20 | {player}'s catchphrase as a game show host | Survey says... no | Come on down! Not you. | And that's why we don't do that
e21 | What {player} would do with a million dollars | Buy a studio with a moat | Hire someone to text back for them | A personal chef who only makes nuggets
e22 | The worst possible job for {player} | Librarian. Too loud. | Anything before 10am | Professional quiet game player
e23 | The name of {player}'s podcast | Well, Actually | Hot Takes, Cold Fries | Me Talking: The Podcast
e24 | {player}'s secret night job | Mall kiosk legend | Professional line-waiter at the theme parks | Mysterious karaoke champion
e25 | {player} as a substitute teacher | Puts on a movie, then reviews it for an hour | Gives detention for bad posture | Teaches the whole class a combo
e26 | What {player} yells on a roller coaster | THIS WAS YOUR IDEA | Five, six, seven, AAAAH | I want my money back. I didn't pay.
e27 | The worst thing {player} could bring to game night | A 400-page rulebook they wrote | Opinions about the scoring | A game only they know the rules to
e28 | {player}'s strongest opinion nobody asked for | Cereal is soup | The second Pub Sub is always better | Ketchup goes in the fridge door. Final answer.
e29 | {player}'s last words before the House wins again | That's rigged | Okay, but mine was funnier | I'd like to speak to the House's manager
e30 | What {player} would put in a time capsule | A selfie, to remind the future | Every unread text | One perfect Pub Sub, sealed
e31 | {player}'s worst nightmare | The group chat goes silent | Rehearsal with no air conditioning | Being on time to something
e32 | What {player} brings to a potluck | Store cookies in a homemade bowl | A bag of ice and a speech | Napkins. Just napkins.
e33 | If {player} ran the country for a day | Mandatory naps. National snack day. | Every meeting is now a dance break | Air conditioning becomes a human right
e34 | What {player}'s mirror says every morning | Oh. It's you again. | Love that for you | We're going with that? Okay.
e35 | {player}'s worst habit, as a superpower | The Power of Being Fashionably Late | Can talk through any movie | Forty Tabs Open, Always
e36 | The one thing {player} can't live without | A charger that reaches the bed | Hot sauce | The last word
e37 | The title of {player}'s self-help book | Just Don't | How to Win Every Argument by Leaving | You're Doing Great (I'm Doing Better)
e38 | The worst thing to hear {player} say at a sleepover | I don't sleep. I just wait. | Want to hear my 40-minute dream? | Did anyone else hear that? No? Cool.
e39 | What {player} is secretly bad at | Whispering | Leaving a party in under an hour | Pretending they're not competitive
e40 | The text {player} sends after losing at game night | Rematch. Now. | Rigged, but congrats | Cool cool cool cool
e41 | The real reason {player} is so good at this game | They read the prompts in advance | Pure spite | They're secretly the House
e42 | {player}'s grocery list, but honest | Chips, more chips, emotional chips | One vegetable, for decoration | Ice cream, for a friend (me)
e43 | What {player} sounds like trying to be quiet | A tap solo | A marching band in socks | Still the loudest one here
`

function parse(raw: string, tag: PromptTag): PackPrompt[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, text, ...house] = line.split('|').map((part) => part.trim())
      return { id, tag, text, house }
    })
}

export const PROMPTS: PackPrompt[] = [
  ...parse(CLASSIC, 'classic'),
  ...parse(FLORIDA, 'florida'),
  ...parse(DANCE, 'dance'),
  ...parse(EACH, 'each'),
]

export const PROMPT_BY_ID: Record<string, PackPrompt> = Object.fromEntries(PROMPTS.map((p) => [p.id, p]))

export const ABOUT = '{player}'

export const PACKS: Record<string, { label: string; has: (p: PackPrompt) => boolean }> = {
  mixed: { label: 'Mixed', has: () => true },
  classic: { label: 'Classic', has: (p) => p.tag === 'classic' },
  florida: { label: 'Florida', has: (p) => p.tag === 'florida' },
  dance: { label: 'Dance life', has: (p) => p.tag === 'dance' },
  each: { label: 'Each other', has: (p) => p.text.includes(ABOUT) },
}

export const PACK_OPTIONS = Object.entries(PACKS).map(([value, p]) => ({ value, label: p.label }))

export function promptsForPack(pack: string): PackPrompt[] {
  const def = PACKS[pack] ?? PACKS.mixed
  return PROMPTS.filter(def.has)
}

/** When a prompt's own spare House answers are taken, Safety quip falls back to these. They fit almost anything. */
export const SAFETY_FALLBACK = [
  'A strongly worded email',
  'Glitter. Way too much glitter.',
  'Honestly? Taxes.',
  'Three raccoons in a trench coat',
  'Whatever Florida Man did last Tuesday',
  'A suspiciously wet sock',
  'The group chat, unfortunately',
  'Absolutely nothing, with confidence',
  'A participation trophy',
  'Five, six, seven, nope',
]
