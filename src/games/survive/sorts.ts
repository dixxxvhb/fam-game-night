// Finale sorts for Survive the Quiz: a statement, two sides, and things that belong on
// exactly one side. Each finale question shows three of them.

export interface SortSet {
  id: string
  prompt: string
  left: string
  right: string
  /** Belong on the left. */
  a: string[]
  /** Belong on the right. */
  b: string[]
}

export const SORTS: SortSet[] = [
  {
    id: 'pixar', prompt: 'Pixar movie, or Walt Disney Animation?', left: 'Pixar', right: 'Disney Animation',
    a: ['Toy Story', 'Finding Nemo', 'Up', 'Coco', 'Inside Out', 'Ratatouille', 'WALL-E', 'Monsters, Inc.', 'Brave', 'Luca', 'Soul', 'Elemental'],
    b: ['Frozen', 'Moana', 'Encanto', 'Tangled', 'Zootopia', 'Big Hero 6', 'Wreck-It Ralph', 'Bolt', 'Wish', 'Raya and the Last Dragon', 'The Princess and the Frog'],
  },
  {
    id: 'eiffel', prompt: 'Taller or shorter than the Eiffel Tower?', left: 'Taller', right: 'Shorter',
    a: ['Burj Khalifa', 'Tokyo Skytree', 'CN Tower', 'Shanghai Tower', 'One World Trade Center', 'Empire State Building', 'Petronas Towers'],
    b: ['Statue of Liberty', 'Space Needle', 'Washington Monument', 'Leaning Tower of Pisa', 'Great Pyramid of Giza', 'Cinderella Castle', 'Big Ben'],
  },
  {
    id: 'mammal', prompt: 'Mammal, or not a mammal?', left: 'Mammal', right: 'Not a mammal',
    a: ['Dolphin', 'Bat', 'Platypus', 'Manatee', 'Walrus', 'Orca', 'Hedgehog', 'Armadillo'],
    b: ['Shark', 'Penguin', 'Crocodile', 'Octopus', 'Flamingo', 'Salamander', 'Sea turtle', 'Stingray'],
  },
  {
    id: 'fruit', prompt: 'Botanically a fruit, or not?', left: 'Fruit', right: 'Not a fruit',
    a: ['Tomato', 'Cucumber', 'Pumpkin', 'Avocado', 'Eggplant', 'Bell pepper', 'Zucchini', 'Olive'],
    b: ['Carrot', 'Potato', 'Celery', 'Lettuce', 'Onion', 'Spinach', 'Asparagus', 'Radish'],
  },
  {
    id: 'y2k', prompt: 'Movie released before 2000, or after?', left: 'Before 2000', right: 'After 2000',
    a: ['Titanic', 'The Matrix', 'Toy Story', 'Jurassic Park', 'The Lion King', 'Clueless', 'Home Alone', 'Forrest Gump', 'The Sixth Sense'],
    b: ['Shrek', 'Finding Nemo', 'Mean Girls', 'Frozen', 'Legally Blonde', 'Spirited Away', 'The Devil Wears Prada', 'High School Musical'],
  },
  {
    id: 'fencing', prompt: 'Ballet term, or fencing term?', left: 'Ballet', right: 'Fencing',
    a: ['Plié', 'Jeté', 'Pirouette', 'Arabesque', 'Relevé', 'Tendu', 'Glissade', 'Pas de bourrée'],
    b: ['Parry', 'Riposte', 'Flèche', 'Touché', 'En garde', 'Épée', 'Foil', 'Sabre'],
  },
  {
    id: 'hamlesmis', prompt: 'Song from Hamilton, or from Les Miserables?', left: 'Hamilton', right: 'Les Mis',
    a: ['My Shot', 'The Room Where It Happens', 'Satisfied', 'Wait for It', 'The Schuyler Sisters', 'Non-Stop', 'Helpless', "You'll Be Back"],
    b: ['I Dreamed a Dream', 'On My Own', 'Master of the House', 'Bring Him Home', 'One Day More', 'Castle on a Cloud', 'Do You Hear the People Sing?', 'Stars'],
  },
  {
    id: 'oz', prompt: 'Song from Wicked, or from The Wizard of Oz (1939)?', left: 'Wicked', right: 'Wizard of Oz',
    a: ['Defying Gravity', 'Popular', 'The Wizard and I', 'For Good', 'Dancing Through Life', 'What Is This Feeling?'],
    b: ['Over the Rainbow', 'If I Only Had a Brain', "We're Off to See the Wizard", 'The Merry Old Land of Oz', 'If I Were King of the Forest'],
  },
  {
    id: 'albums', prompt: 'Taylor Swift album, or Beyoncé album?', left: 'Taylor Swift', right: 'Beyoncé',
    a: ['Fearless', 'Red', '1989', 'Reputation', 'Lover', 'Folklore', 'Evermore', 'Midnights', 'Speak Now'],
    b: ['Lemonade', 'Renaissance', 'Cowboy Carter', 'Dangerously in Love', "B'Day", '4', 'I Am... Sasha Fierce'],
  },
  {
    id: 'coast', prompt: 'Florida city: Atlantic coast, or Gulf coast?', left: 'Atlantic', right: 'Gulf',
    a: ['Miami', 'Fort Lauderdale', 'Daytona Beach', 'Jacksonville', 'St. Augustine', 'West Palm Beach', 'Cocoa Beach', 'Boca Raton'],
    b: ['Tampa', 'St. Petersburg', 'Clearwater', 'Sarasota', 'Naples', 'Fort Myers', 'Pensacola', 'Destin'],
  },
  {
    id: 'element', prompt: 'A real chemical element, or not?', left: 'Element', right: 'Not an element',
    a: ['Neon', 'Argon', 'Cobalt', 'Titanium', 'Tungsten', 'Krypton', 'Bismuth', 'Helium'],
    b: ['Steel', 'Bronze', 'Brass', 'Kryptonite', 'Quartz', 'Granite', 'Porcelain', 'Vibranium'],
  },
  {
    id: 'latin', prompt: 'Dance born in Latin America, or somewhere else?', left: 'Latin America', right: 'Elsewhere',
    a: ['Tango', 'Samba', 'Merengue', 'Bachata', 'Cha-cha-cha', 'Mambo', 'Cumbia'],
    b: ['Flamenco', 'Polka', 'Waltz', 'Irish step dance', 'Bharatanatyam', 'Hula', 'Haka', 'Charleston'],
  },
  {
    id: 'villain', prompt: 'Disney villain, or Disney sidekick?', left: 'Villain', right: 'Sidekick',
    a: ['Scar', 'Ursula', 'Jafar', 'Maleficent', 'Hades', 'Gaston', 'Cruella de Vil', 'Mother Gothel', 'Captain Hook'],
    b: ['Timon', 'Sebastian', 'Abu', 'Flounder', 'Mushu', 'Olaf', 'Pascal', 'Pua', 'Meeko'],
  },
  {
    id: 'usa', prompt: 'Older or younger than the United States (1776)?', left: 'Older', right: 'Younger',
    a: ['Harvard University', 'The Taj Mahal', 'Machu Picchu', 'St. Augustine, Florida', 'The Colosseum', 'Stonehenge', 'The Mona Lisa'],
    b: ['The Statue of Liberty', 'The Eiffel Tower', 'Big Ben', 'Walt Disney World', 'The Golden Gate Bridge', 'The Brooklyn Bridge', 'Mount Rushmore'],
  },
  {
    id: 'moon', prompt: 'Planet, or moon?', left: 'Planet', right: 'Moon',
    a: ['Mercury', 'Neptune', 'Uranus', 'Venus', 'Mars', 'Saturn', 'Jupiter'],
    b: ['Titan', 'Europa', 'Ganymede', 'Io', 'Phobos', 'Triton', 'Callisto', 'Enceladus'],
  },
  {
    id: 'hplotr', prompt: 'Harry Potter character, or Lord of the Rings?', left: 'Harry Potter', right: 'Lord of the Rings',
    a: ['Hagrid', 'Dobby', 'Hermione', 'Dumbledore', 'Snape', 'Neville', 'Luna', 'Sirius'],
    b: ['Gandalf', 'Frodo', 'Legolas', 'Gimli', 'Samwise', 'Aragorn', 'Gollum', 'Galadriel'],
  },
  {
    id: 'marveldc', prompt: 'Marvel character, or DC character?', left: 'Marvel', right: 'DC',
    a: ['Black Panther', 'Thor', 'Wolverine', 'Spider-Man', 'Iron Man', 'Doctor Strange', 'Black Widow', 'Hulk'],
    b: ['Aquaman', 'The Flash', 'Wonder Woman', 'Green Lantern', 'Batman', 'Cyborg', 'Supergirl', 'Harley Quinn'],
  },
  {
    id: 'parks', prompt: 'Theme park in Florida, or in California?', left: 'Florida', right: 'California',
    a: ['Epcot', 'Islands of Adventure', 'Busch Gardens Tampa Bay', 'SeaWorld Orlando', 'Volcano Bay', 'Animal Kingdom', 'Epic Universe', 'Hollywood Studios'],
    b: ['Disneyland', "Knott's Berry Farm", 'Six Flags Magic Mountain', 'Universal Studios Hollywood', 'SeaWorld San Diego', 'Disney California Adventure'],
  },
  {
    id: 'nyc', prompt: 'Sitcom set in New York City, or somewhere else?', left: 'New York City', right: 'Elsewhere',
    a: ['Friends', 'Seinfeld', 'How I Met Your Mother', '30 Rock', 'Brooklyn Nine-Nine', 'Will & Grace', 'Broad City', '2 Broke Girls'],
    b: ['The Office', 'Parks and Recreation', 'Modern Family', 'Cheers', 'Frasier', 'The Big Bang Theory', "Schitt's Creek", 'Abbott Elementary'],
  },
  {
    id: 'landlocked', prompt: 'Landlocked country, or has a coastline?', left: 'Landlocked', right: 'Coastline',
    a: ['Switzerland', 'Austria', 'Bolivia', 'Paraguay', 'Nepal', 'Mongolia', 'Hungary', 'Ethiopia'],
    b: ['Peru', 'Chile', 'Portugal', 'Belgium', 'Croatia', 'Kenya', 'Vietnam', 'Norway'],
  },
  {
    id: 'loanwords', prompt: 'English borrowed it from French, or from Spanish?', left: 'French', right: 'Spanish',
    a: ['Ballet', 'Souvenir', 'Rendezvous', 'Croissant', 'Boutique', 'Chauffeur', 'Deja vu', 'Entrepreneur'],
    b: ['Patio', 'Rodeo', 'Lasso', 'Canyon', 'Plaza', 'Alligator', 'Mosquito', 'Cafeteria'],
  },
  {
    id: 'stage', prompt: 'Broadway musical based on a movie, or not?', left: 'From a movie', right: 'Not a movie',
    a: ['Hairspray', 'The Lion King', 'Legally Blonde', 'Mean Girls', 'Beetlejuice', 'Kinky Boots', 'Waitress', 'The Producers', 'Billy Elliot'],
    b: ['Hamilton', 'Wicked', 'Rent', 'Les Miserables', 'Six', 'Dear Evan Hansen', 'Hadestown', 'Come From Away', 'Cats'],
  },
  {
    id: 'dishes', prompt: 'Dish from Italy, or from Mexico?', left: 'Italy', right: 'Mexico',
    a: ['Risotto', 'Carbonara', 'Tiramisu', 'Gnocchi', 'Bruschetta', 'Osso buco', 'Panna cotta', 'Cannoli'],
    b: ['Mole', 'Chilaquiles', 'Pozole', 'Tamales', 'Elote', 'Enchiladas', 'Cochinita pibil', 'Tlayudas'],
  },
  {
    id: 'teams', prompt: 'NBA team, or NFL team?', left: 'NBA', right: 'NFL',
    a: ['Orlando Magic', 'Miami Heat', 'Boston Celtics', 'Chicago Bulls', 'Golden State Warriors', 'New York Knicks', 'Los Angeles Lakers', 'Phoenix Suns'],
    b: ['Jacksonville Jaguars', 'Miami Dolphins', 'Tampa Bay Buccaneers', 'Green Bay Packers', 'Pittsburgh Steelers', 'Philadelphia Eagles', 'Dallas Cowboys', 'Kansas City Chiefs'],
  },
  {
    id: 'gagakaty', prompt: 'Lady Gaga song, or Katy Perry song?', left: 'Lady Gaga', right: 'Katy Perry',
    a: ['Poker Face', 'Bad Romance', 'Just Dance', 'Born This Way', 'Telephone', 'Rain on Me', 'Shallow', 'Applause'],
    b: ['Firework', 'Roar', 'Teenage Dream', 'Dark Horse', 'California Gurls', 'Hot n Cold', 'Last Friday Night', 'Wide Awake'],
  },
  {
    id: 'composers', prompt: 'Music by Andrew Lloyd Webber, or Stephen Sondheim?', left: 'Lloyd Webber', right: 'Sondheim',
    a: ['Cats', 'The Phantom of the Opera', 'Evita', 'Sunset Boulevard', 'Starlight Express', 'School of Rock', 'Aspects of Love'],
    b: ['Into the Woods', 'Company', 'Follies', 'Sunday in the Park with George', 'A Little Night Music', 'Merrily We Roll Along', 'Passion', 'Pacific Overtures'],
  },
  {
    id: 'insect', prompt: 'Insect, or not an insect?', left: 'Insect', right: 'Not an insect',
    a: ['Ant', 'Butterfly', 'Beetle', 'Grasshopper', 'Ladybug', 'Dragonfly', 'Bee', 'Firefly'],
    b: ['Spider', 'Scorpion', 'Tick', 'Centipede', 'Earthworm', 'Millipede', 'Crab', 'Snail'],
  },
  {
    id: 'street', prompt: 'Street dance style, or ballroom dance?', left: 'Street', right: 'Ballroom',
    a: ['Popping', 'Locking', 'Krumping', 'Breaking', 'Tutting', 'Waacking', 'House'],
    b: ['Foxtrot', 'Quickstep', 'Waltz', 'Viennese waltz', 'Paso doble', 'Jive', 'Cha-cha'],
  },
  {
    id: 'dcom', prompt: 'Disney Channel Original Movie (DCOM), or not?', left: 'DCOM', right: 'Not a DCOM',
    a: ['High School Musical', 'Camp Rock', 'Zombies', 'Descendants', 'Halloweentown', 'The Cheetah Girls', 'Teen Beach Movie', 'Twitches'],
    b: ['Mean Girls', 'Bring It On', 'Legally Blonde', "She's the Man", 'Aquamarine', 'Clueless', '13 Going on 30', 'Center Stage'],
  },
  {
    id: 'bestpic', prompt: 'Won the Oscar for Best Picture, or did not?', left: 'Won', right: 'Did not',
    a: ['Titanic', 'Parasite', 'Gladiator', 'Chicago', 'Moonlight', 'Forrest Gump', 'Everything Everywhere All at Once', 'CODA', 'Oppenheimer'],
    b: ['Avatar', 'La La Land', 'Star Wars', 'Jaws', 'Toy Story 3', 'Top Gun: Maverick', 'Barbie', 'Black Swan', 'Pulp Fiction', 'The Wizard of Oz'],
  },
  {
    id: 'capital', prompt: 'Capital city, or not the capital?', left: 'Capital', right: 'Not the capital',
    a: ['Canberra', 'Ottawa', 'Brasilia', 'Wellington', 'Ankara', 'Nairobi', 'Lima', 'Hanoi'],
    b: ['Sydney', 'Toronto', 'Rio de Janeiro', 'Auckland', 'Istanbul', 'Zurich', 'Mumbai', 'Barcelona'],
  },
]
