// What a bot knows for Categories: a few common answers by kind, routed by keywords in the
// category name. A bot only answers when it has something that fits; otherwise it leaves the
// slot blank, like a person who's stuck. PG-13.

const KINDS: Record<string, string> = {
  animal: 'Alligator|Anteater|Bear|Beaver|Camel|Cheetah|Dolphin|Donkey|Eagle|Elephant|Falcon|Ferret|Giraffe|Goat|Hippo|Hamster|Iguana|Impala|Jaguar|Jellyfish|Kangaroo|Koala|Lion|Llama|Monkey|Moose|Narwhal|Newt|Octopus|Otter|Penguin|Parrot|Rabbit|Raccoon|Shark|Sloth|Tiger|Turtle|Walrus|Wolf',
  food: 'Apple|Avocado|Bagel|Banana|Carrot|Cookie|Donut|Dumpling|Eggplant|Eclair|Fudge|Fig|Grape|Garlic|Ham|Honey|Ice cream|Jam|Jelly beans|Kale|Kiwi|Lemon|Lasagna|Mango|Muffin|Nachos|Noodles|Olive|Omelet|Pizza|Pickle|Ravioli|Rice|Salsa|Sushi|Taco|Toast|Waffle|Watermelon',
  boy: 'Aaron|Ben|Brandon|Carlos|Chris|David|Derek|Ethan|Eric|Frank|Gavin|Henry|Hugo|Isaac|Ivan|Jake|James|Kevin|Kyle|Leo|Liam|Mason|Miles|Nathan|Noah|Oscar|Owen|Peter|Paul|Ryan|Riley|Sam|Seth|Tyler|Theo|Will|Wyatt',
  girl: 'Abby|Ava|Bella|Brooke|Chloe|Claire|Daisy|Dana|Emma|Ella|Fiona|Faith|Grace|Gwen|Hannah|Holly|Ivy|Isla|Jade|Julia|Kate|Kayla|Lily|Luna|Mia|Maya|Nora|Nina|Olivia|Paige|Piper|Ruby|Rose|Sophie|Sara|Tessa|Tara|Wendy|Willow',
  city: 'Atlanta|Austin|Boston|Baltimore|Chicago|Dallas|Denver|Detroit|El Paso|Fresno|Gainesville|Houston|Honolulu|Indianapolis|Jacksonville|Kansas City|Kissimmee|Las Vegas|London|Miami|Memphis|Nashville|New York|Orlando|Ocala|Paris|Phoenix|Raleigh|Rome|Seattle|Sarasota|Tampa|Toronto|Washington',
  country: 'Argentina|Australia|Brazil|Belgium|Canada|Chile|Denmark|Egypt|England|France|Finland|Germany|Greece|Haiti|Hungary|India|Ireland|Italy|Jamaica|Japan|Kenya|Korea|Lebanon|Mexico|Morocco|Norway|Nepal|Oman|Peru|Poland|Portugal|Russia|Spain|Sweden|Thailand|Turkey|Wales',
  state: 'Alabama|Alaska|Arizona|California|Colorado|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Kansas|Kentucky|Louisiana|Maine|Montana|Nevada|Nebraska|Ohio|Oregon|Pennsylvania|Rhode Island|Texas|Tennessee|Utah|Washington|Wyoming',
  thing: 'Alarm clock|Battery|Blanket|Candle|Charger|Desk lamp|Duct tape|Eraser|Extension cord|Flashlight|Fork|Glue|Glasses|Hammer|Headphones|Ink pen|Iron|Jar|Key|Keychain|Lamp|Lint roller|Magnet|Mirror|Notebook|Nail|Oven mitt|Pencil|Pillow|Remote|Ruler|Scissors|Stapler|Tape|Toothbrush|Towel|Wallet|Wrench',
  clothing: 'Apron|Ankle socks|Belt|Beanie|Boots|Cardigan|Cap|Dress|Denim jacket|Earrings|Flip flops|Fedora|Gloves|Gown|Hoodie|Hat|Jeans|Jacket|Kimono|Leggings|Leotard|Mittens|Necklace|Overalls|Pajamas|Poncho|Robe|Ring|Scarf|Sneakers|Sweater|Tights|Tank top|Watch|Wig',
  sport: 'Archery|Baseball|Basketball|Bowling|Cheer|Cycling|Darts|Diving|Fencing|Football|Golf|Gymnastics|Hockey|Hiking|Ice skating|Judo|Karate|Kickball|Lacrosse|Marathon|Netball|Polo|Pickleball|Rowing|Rugby|Soccer|Surfing|Swimming|Tennis|Track|Volleyball|Wrestling|Water polo',
  job: 'Accountant|Actor|Baker|Barber|Chef|Coach|Dentist|Doctor|Electrician|Engineer|Farmer|Firefighter|Gardener|Hairdresser|Hostess|Insurance agent|Janitor|Judge|Lawyer|Lifeguard|Mechanic|Musician|Nurse|Nanny|Optometrist|Plumber|Pilot|Realtor|Reporter|Singer|Surgeon|Teacher|Tailor|Waiter|Writer',
  color: 'Aqua|Amber|Black|Blue|Brown|Cyan|Coral|Denim|Emerald|Fuchsia|Gold|Gray|Green|Hot pink|Indigo|Ivory|Jade|Khaki|Lavender|Lime|Magenta|Maroon|Navy|Orange|Olive|Pink|Purple|Red|Rose|Silver|Scarlet|Teal|Tan|White|Wine',
  instrument: 'Accordion|Bagpipes|Banjo|Bass|Cello|Clarinet|Drums|Didgeridoo|Electric guitar|Flute|French horn|Guitar|Gong|Harp|Harmonica|Kazoo|Keyboard|Lute|Maracas|Mandolin|Oboe|Organ|Piano|Piccolo|Recorder|Saxophone|Sitar|Tambourine|Trumpet|Tuba|Triangle|Viola|Violin|Whistle',
  dance: 'Arabesque|Attitude|Ballet|Breakdance|Ballroom|Chasse|Contemporary|Cha cha|Disco|Fouette|Flamenco|Foxtrot|Grand jete|Hip hop|House|Irish dance|Jazz|Jive|Krump|Lyrical|Line dance|Modern|Mambo|Pirouette|Pas de bourree|Plie|Polka|Releve|Rumba|Salsa|Samba|Swing|Tango|Tap|Tendu|Two step|Waltz|Waacking',
  body: 'Ankle|Arm|Back|Belly button|Calf|Chin|Elbow|Ear|Finger|Foot|Glutes|Hip|Hamstring|Heel|Index finger|Jaw|Knee|Knuckle|Leg|Lower back|Neck|Nose|Pinky toe|Rib|Shoulder|Shin|Thigh|Toe|Thumb|Wrist|Waist',
  weather: 'Avalanche|Blizzard|Breeze|Cloud|Cyclone|Drizzle|Downpour|Earthquake|Fog|Flood|Frost|Gale|Hail|Hurricane|Heat wave|Ice storm|Lightning|Mist|Monsoon|Overcast|Rain|Rainbow|Sleet|Snow|Storm|Thunder|Tornado|Typhoon|Wind|Whiteout',
  movie: 'Aladdin|Avatar|Bambi|Barbie|Cars|Coco|Dune|Encanto|Elf|Frozen|Finding Nemo|Grease|Gravity|Hercules|Hairspray|Inside Out|Jaws|Jumanji|Kung Fu Panda|Lilo and Stitch|Matilda|Moana|Mulan|Night at the Museum|Oppenheimer|Pinocchio|Ratatouille|Rocky|Shrek|Star Wars|Tangled|Titanic|Toy Story|Up|Wicked|Wall-E',
  disney: 'Ariel|Aladdin|Baloo|Belle|Buzz|Cinderella|Dumbo|Daisy Duck|Elsa|Eeyore|Flounder|Goofy|Gaston|Hades|Hercules|Ian|Jasmine|Jafar|Kristoff|Lumiere|Mickey|Minnie|Moana|Mulan|Nemo|Olaf|Pluto|Pumbaa|Rapunzel|Simba|Stitch|Tinker Bell|Tiana|Timon|Woody|Wall-E',
  florida: 'Alligator|Airboat|Beach|Bougainvillea|Citrus|Cocoa Beach|Disney|Daytona|Everglades|Egret|Flamingo|Gator|Gulf|Heron|Hurricane|Iguana|Jacksonville|Key lime pie|Key West|Lovebugs|Lightning|Manatee|Mosquito|Mangrove|Naples|Orange|Orlando|Palm tree|Pelican|Publix|Rain|Sunscreen|Sinkhole|Sand|Tampa|Theme park|Tourists|Wawa|Water park',
  music: 'Adele|Abba|Beyonce|Bruno Mars|Coldplay|Cher|Drake|Dua Lipa|Ed Sheeran|Elton John|Fleetwood Mac|Gaga|Green Day|Harry Styles|Imagine Dragons|Journey|Jonas Brothers|Katy Perry|Kelly Clarkson|Lizzo|Madonna|Maroon 5|Nirvana|Olivia Rodrigo|Pink|Prince|Queen|Rihanna|Shakira|Sabrina Carpenter|Taylor Swift|Usher|Weezer|Whitney Houston',
  genre: 'Alternative|Blues|Bluegrass|Country|Classical|Disco|Dubstep|Electronic|Emo|Folk|Funk|Gospel|Grunge|Hip hop|House|Indie|Jazz|K-pop|Latin|Lo-fi|Metal|Motown|New wave|Opera|Pop|Punk|R&B|Rap|Reggae|Rock|Salsa|Soul|Swing|Techno|Trap|World',
  vehicle: 'Ambulance|Airplane|Bike|Bus|Boat|Car|Canoe|Dump truck|Firetruck|Forklift|Go-kart|Golf cart|Helicopter|Hovercraft|Ice cream truck|Jeep|Jet ski|Kayak|Limo|Motorcycle|Minivan|Pickup truck|Rocket|Scooter|Skateboard|Submarine|Tractor|Train|Truck|Wagon',
  game: 'Apex Legends|Battleship|Bingo|Checkers|Chess|Candy Land|Clue|Dominoes|Euchre|Fortnite|Go Fish|Hungry Hippos|Jenga|Kirby|Life|Mario Kart|Minecraft|Monopoly|Operation|Pac-Man|Poker|Pictionary|Risk|Rummy|Scrabble|Sorry|Tetris|Twister|Uno|War|Wordle|Yahtzee',
  bird: 'Albatross|Blue jay|Bald eagle|Cardinal|Crow|Dove|Duck|Eagle|Egret|Falcon|Flamingo|Goose|Hawk|Heron|Hummingbird|Ibis|Jay|Kingfisher|Lark|Loon|Macaw|Magpie|Nightingale|Owl|Ostrich|Parrot|Pelican|Penguin|Raven|Robin|Sparrow|Swan|Toucan|Turkey|Woodpecker|Wren',
  sea: 'Anchovy|Angelfish|Barracuda|Bass|Clam|Crab|Catfish|Dolphin|Eel|Flounder|Grouper|Goldfish|Halibut|Jellyfish|Lobster|Mackerel|Manta ray|Narwhal|Octopus|Oyster|Pufferfish|Piranha|Salmon|Shark|Shrimp|Squid|Starfish|Tuna|Trout|Walrus|Whale',
  bug: 'Ant|Aphid|Bee|Beetle|Butterfly|Caterpillar|Cricket|Cockroach|Dragonfly|Earwig|Firefly|Flea|Gnat|Grasshopper|Hornet|Inchworm|Katydid|Ladybug|Lovebug|Mosquito|Moth|No-see-um|Praying mantis|Roach|Spider|Stink bug|Termite|Tick|Wasp|Weevil',
  flower: 'Azalea|Aster|Begonia|Buttercup|Carnation|Daisy|Daffodil|Dahlia|Edelweiss|Freesia|Gardenia|Geranium|Hibiscus|Hydrangea|Iris|Jasmine|Lily|Lavender|Lilac|Magnolia|Marigold|Narcissus|Orchid|Peony|Poppy|Rose|Sunflower|Snapdragon|Tulip|Violet|Wisteria',
  room: 'Apron|Blender|Bowl|Bread|Coffee maker|Cutting board|Dish soap|Eggs|Freezer|Fork|Grater|Grill|Hot sauce|Juice|Kettle|Knife|Ladle|Mixer|Microwave|Napkin|Oven|Pan|Plate|Pot|Refrigerator|Rolling pin|Sink|Spatula|Spoon|Stove|Toaster|Tongs|Whisk|Wok',
}

/**
 * Category wording to answer kinds. First match wins. The first line sends categories a
 * word list would answer badly (quotes, things to say, famous people) to blank on purpose.
 */
const ROUTES: [RegExp, string | null][] = [
  [/from tv|florida man|hurricane supplies|movie quotes|horror|job interview|first date|villain|superhero|languages|game shows|movie theater|famous|movie stars|car brands/i, null],
  [/boy's name|nicknames|names for a goldfish|bad names for a pet/i, 'boy'],
  [/girl's name/i, 'girl'],
  [/florida cities|^cities$|vacation spots/i, 'city'],
  [/^countries$/i, 'country'],
  [/us states/i, 'state'],
  [/weather|things in the sky/i, 'weather'],
  [/disney characters|pixar|princess|sidekick|cartoon characters|disney park/i, 'disney'],
  [/^movies$|animated movies|dance movies|disney movies/i, 'movie'],
  [/music genres/i, 'genre'],
  [/singers|^bands$|celebrities/i, 'music'],
  [/instrument/i, 'instrument'],
  [/fruit|vegetable|snack|dessert|candy|breakfast|pizza topping|salad|burger|ice cream|fridge|fast food/i, 'food'],
  [/dance styles|dance moves|ballet terms|stage directions|ways to warm up|choreographer yells/i, 'dance'],
  [/birds|things that fly/i, 'bird'],
  [/fish|sea creature/i, 'sea'],
  [/insect|\bbugs?\b/i, 'bug'],
  [/flowers|trees/i, 'flower'],
  [/animals|zoo|farm|\bpets\b|reptile|forest|bite/i, 'animal'],
  [/kitchen|grocery|publix/i, 'room'],
  [/body parts|hurt after class/i, 'body'],
  [/^colors$/i, 'color'],
  [/^sports$|hobbies/i, 'sport'],
  [/^jobs$/i, 'job'],
  [/clothing|shoes|wear on your head|accessor|costume|dance bag|pack for vacation|quick change/i, 'clothing'],
  [/wheels|motor/i, 'vehicle'],
  [/board games|card games|video games|^toys$/i, 'game'],
  [/junk drawer|plug in|garage|tools|toolbox|office supplies|backpack|classroom|things you lose|buttons|collect|bathroom|furniture|hotel room|can break|can throw|can open|under the couch|purse/i, 'thing'],
  [/beach|swamp|things in florida/i, 'florida'],
]

const SPLIT = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.split('|')]))

export function kindFor(category: string): string | null {
  for (const [re, kind] of ROUTES) if (re.test(category)) return kind
  return null
}

/** Answers a bot could give for this category and letter (may be empty). */
export function botOptions(category: string, letter: string): string[] {
  const kind = kindFor(category)
  if (!kind) return []
  return (SPLIT[kind] ?? []).filter((w) => w[0]?.toUpperCase() === letter.toUpperCase())
}

export const BOT_KINDS = KINDS
