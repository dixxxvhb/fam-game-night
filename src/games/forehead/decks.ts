// Decks for Forehead. Every word has to be actable, hummable or describable in a few seconds.
// PG-13: John is 17. Celebrities are household names, nobody famous for being in trouble.

export interface Deck { label: string; words: string[] }

const CLASSIC = [
  // things
  'Toothbrush', 'Umbrella', 'Trampoline', 'Microwave', 'Roller skates', 'Hot air balloon', 'Vacuum cleaner',
  'Alarm clock', 'Treadmill', 'Hammock', 'Birthday cake', 'Sunglasses', 'Remote control', 'Bubble wrap',
  'Piggy bank', 'Fire hydrant', 'Shopping cart', 'Traffic cone', 'Stapler', 'Toaster', 'Rubber duck',
  'Lawn mower', 'Snow globe', 'Lava lamp', 'Ceiling fan', 'Selfie stick', 'Fidget spinner', 'Pogo stick',
  'Slinky', 'Whoopee cushion',
  // animals
  'Giraffe', 'Kangaroo', 'Penguin', 'Octopus', 'Sloth', 'Gorilla', 'Peacock', 'Hippo', 'Cheetah', 'Koala',
  'Llama', 'Turkey', 'Rooster', 'Jellyfish', 'Lobster', 'Butterfly', 'Spider', 'Elephant', 'Hedgehog',
  'Woodpecker', 'Chihuahua', 'Goldfish', 'Bat', 'Camel', 'T. rex',
  // actions
  'Brushing teeth', 'Skydiving', 'Surfing', 'Sneezing', 'Juggling', 'Yawning', 'Bowling', 'Painting nails',
  'Walking a dog', 'Rock climbing', 'Ice skating', 'Jump rope', 'Hula hoop', 'Karate', 'Fishing',
  'Sleepwalking', 'Taking a selfie', 'Parallel parking', 'Flipping pancakes', 'Blowing bubbles',
  'Doing laundry', 'Milking a cow', 'Air guitar', 'Sword fighting', 'Tightrope walking', 'Changing a tire',
  'Losing your keys', 'Stubbing your toe', 'Brain freeze', 'Hiccups',
]

const MOVIES = [
  'Titanic', 'Jaws', 'Frozen', 'The Lion King', 'Toy Story', 'Finding Nemo', 'Shrek', 'Up', 'Jurassic Park',
  'Star Wars', 'Harry Potter', 'The Wizard of Oz', 'Home Alone', 'Mean Girls', 'Barbie', 'Wicked', 'Grease',
  'Mamma Mia', 'The Greatest Showman', 'La La Land', 'Back to the Future', 'Ghostbusters', 'E.T.', 'Spider-Man',
  'Black Panther', 'The Avengers', 'The Matrix', 'Inception', 'Avatar', 'The Hunger Games', 'Pirates of the Caribbean',
  'Jumanji', 'Ice Age', 'Madagascar', 'Kung Fu Panda', 'Moana', 'Encanto', 'Coco', 'Inside Out', 'Ratatouille',
  'WALL-E', 'Monsters Inc', 'The Incredibles', 'Zootopia', 'Tangled', 'Beauty and the Beast', 'The Little Mermaid',
  'Aladdin', 'Mulan', 'Cinderella', 'Lilo and Stitch', 'Cars', 'Despicable Me', 'Minions', 'Elf', 'The Grinch',
  'Rocky', 'Top Gun', 'Twister', 'King Kong', 'Godzilla', 'The Karate Kid', 'Legally Blonde', 'The Princess Diaries',
  'High School Musical', 'Night at the Museum', 'School of Rock', 'Mrs. Doubtfire', 'Forrest Gump',
  'The Sound of Music', 'Mary Poppins', 'Willy Wonka', 'Matilda', 'The Parent Trap', 'Freaky Friday', 'Pitch Perfect',
  'Hairspray', 'The Goonies', 'The Sandlot', 'Space Jam', 'Men in Black', 'Transformers', 'Iron Man',
  'Guardians of the Galaxy', 'Wonder Woman', 'Batman', 'Gravity', 'Dune', 'Oppenheimer', 'Mission Impossible',
]

const DANCE = [
  // moves
  'Pirouette', 'Grand jete', 'Fouette', 'Moonwalk', 'The floss', 'The worm', 'The robot', 'The sprinkler',
  'Running man', 'Electric slide', 'Cha cha slide', 'Macarena', 'Cupid shuffle', 'The Charleston', 'The twist',
  'YMCA', 'The Carlton', 'The Griddy', 'Thriller dance', 'Jazz hands', 'Kick ball change', 'Pas de bourree',
  'Box step', 'Fan kick', 'Toe touch', 'Back walkover', 'The splits', 'Headspin', 'Windmill', 'Chaine turns',
  'Death drop', 'Limbo', 'Conga line', 'The chicken dance', 'Hokey pokey', 'Shimmy', 'Body roll', 'Hair whip',
  // styles
  'Tap dance', 'Ballet', 'Hip hop', 'Contemporary', 'Lyrical', 'Ballroom', 'Line dancing', 'Square dance',
  'Salsa', 'Tango', 'Waltz', 'Swing', 'Flamenco', 'Irish dance', 'Breakdancing', 'Popping and locking', 'Voguing',
  // shows and films
  'So You Think You Can Dance', 'Dancing with the Stars', 'Dance Moms', 'A Chorus Line', 'Cats', 'Hamilton',
  'West Side Story', 'The Nutcracker', 'Swan Lake', 'Chicago', 'Dirty Dancing', 'Footloose', 'Flashdance',
  'Saturday Night Fever', 'Billy Elliot', 'Black Swan', 'Center Stage', 'Step Up', 'Fame', 'Happy Feet',
  // dancers
  'Misty Copeland', 'Mikhail Baryshnikov', 'Gene Kelly', 'Fred Astaire', 'Ginger Rogers', 'Bob Fosse',
  'Martha Graham', 'Alvin Ailey', 'Gregory Hines', 'Paula Abdul', 'Derek Hough', 'Maddie Ziegler', 'JoJo Siwa',
  // terms
  'Plie', 'Releve', 'Arabesque', 'Five six seven eight', 'From the top', 'Mark it', 'Choreography', 'Audition',
  'Recital', 'Competition weekend', 'Dress rehearsal', 'Warm up', 'Turnout', 'Pointe shoes', 'Leotard',
  'Bobby pins', 'Stage left', 'Downstage', 'The wings', 'Spotlight', 'Curtain call', 'Standing ovation',
  'Quick change', 'Stage fright', 'Tech week', 'Sore calves', 'Barre',
]

const CELEBRITIES = [
  'Taylor Swift', 'Beyonce', 'Rihanna', 'Lady Gaga', 'Ariana Grande', 'Billie Eilish', 'Harry Styles', 'Zendaya',
  'Tom Holland', 'Dwayne Johnson', 'Oprah', 'Jennifer Lopez', 'Shakira', 'Bad Bunny', 'Dolly Parton', 'Elton John',
  'Freddie Mercury', 'Elvis Presley', 'Britney Spears', 'Lin-Manuel Miranda', 'Hugh Jackman', 'Meryl Streep',
  'Tom Hanks', 'Keanu Reeves', 'Ryan Reynolds', 'Jack Black', 'Jim Carrey', 'Kevin Hart', 'Gordon Ramsay',
  'Simone Biles', 'Serena Williams', 'LeBron James', 'Michael Jordan', 'Tom Brady', 'Usain Bolt', 'Lionel Messi',
  'Cristiano Ronaldo', 'Shaquille O\'Neal', 'Albert Einstein', 'Abraham Lincoln', 'Cleopatra', 'Shakespeare',
  'Mozart', 'Marilyn Monroe', 'Audrey Hepburn', 'Mr. Rogers', 'Bob Ross', 'Steve Irwin', 'Bill Nye',
  'Pitbull', 'Sabrina Carpenter', 'Olivia Rodrigo', 'Selena Gomez', 'Miley Cyrus', 'Dua Lipa', 'Bruno Mars',
  'Ed Sheeran', 'Adele', 'Lizzo', 'Pedro Pascal', 'Timothee Chalamet', 'Margot Robbie', 'Ryan Gosling',
  'Emma Stone', 'Sandra Bullock', 'Morgan Freeman', 'Danny DeVito', 'Betty White', 'Steve Carell', 'Tina Fey',
  'Jimmy Fallon', 'RuPaul', 'Cher', 'Celine Dion', 'Mariah Carey', 'Whitney Houston', 'Paul McCartney',
  'Guy Fieri', 'Steve Jobs', 'MrBeast', 'Walt Disney', 'Dr. Seuss', 'Tony Hawk', 'Michael Phelps', 'Babe Ruth',
  'Muhammad Ali', 'Patrick Mahomes', 'Steph Curry', 'Caitlin Clark',
]

const FLORIDA = [
  'Alligator', 'Flamingo', 'Manatee', 'Hurricane', 'Sunscreen', 'Orange juice', 'Key lime pie', 'Cuban sandwich',
  'Everglades', 'Miami', 'Orlando', 'Tampa', 'Key West', 'Daytona Beach', 'Lovebugs', 'Palmetto bug', 'Humidity',
  'Afternoon thunderstorm', 'Sinkhole', 'Florida Man', 'Publix', 'Pub sub', 'Disney World', 'Universal Studios',
  'SeaWorld', 'Kennedy Space Center', 'Rocket launch', 'Airboat', 'Mangrove', 'Pelican', 'Sea turtle', 'Dolphin',
  'Iguana', 'Mosquito', 'Flip flops', 'Golf cart', 'Retirement community', 'Early bird special', 'Snowbird',
  'I-4 traffic', 'Toll road', 'SunPass', 'Gatorade', 'Miami Heat', 'Orlando Magic', 'Tampa Bay Buccaneers',
  'Miami Dolphins', 'Hurricane party', 'Generator', 'Plywood on the windows', 'Spanish moss', 'Palm tree',
  'Gulf of Mexico', 'Lake Okeechobee', 'Stone crab', 'Gator bites', 'Boiled peanuts', 'Sweet tea', 'Cruise ship',
  'Daytona 500', 'Cocoa Beach', 'St. Augustine', 'Fountain of Youth', 'Seven Mile Bridge', 'Epcot',
  'Magic Kingdom', 'Cinderella Castle', 'Lazy river', 'Water park', 'Gatorland', 'Wawa', 'Hurricane season',
  'Rain poncho', 'Sand in your shoes', 'Sunburn', 'Theme park line', 'Lightning capital', 'Beach umbrella',
  'Conch fritters', 'Pool noodle',
]

export const DECKS: Record<string, Deck> = {
  classic: { label: 'Classic', words: CLASSIC },
  movies: { label: 'Movies', words: MOVIES },
  dance: { label: 'Dance', words: DANCE },
  celebrities: { label: 'Celebrities', words: CELEBRITIES },
  florida: { label: 'Florida', words: FLORIDA },
  mixed: { label: 'Mixed', words: [...new Set([...CLASSIC, ...MOVIES, ...DANCE, ...CELEBRITIES, ...FLORIDA])] },
}

export const DECK_OPTIONS = Object.entries(DECKS).map(([value, d]) => ({ value, label: d.label }))
