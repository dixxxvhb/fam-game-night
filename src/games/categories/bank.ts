// Categories for Categories. Eight come up per round, never twice in one game.
// PG-13: John is 17. Each one has to work with most letters, so nothing too narrow.

const CLASSIC = [
  'A boy\'s name', 'A girl\'s name', 'Animals', 'Things in a fridge', 'Fruits', 'Vegetables', 'Cities',
  'Countries', 'US states', 'Things at a beach', 'Things in a kitchen', 'Sports', 'Jobs', 'Colors',
  'Things that are cold', 'Things that are hot', 'Things that are sticky', 'Things that are round',
  'Things with wheels', 'Things with a motor', 'Things you plug in', 'Things in a junk drawer',
  'Board games', 'Card games', 'Video games', 'Toys', 'Cartoon characters', 'Superheroes', 'Villains',
  'Musical instruments', 'Bands', 'Singers', 'Songs', 'TV shows', 'Breakfast foods', 'Desserts',
  'Candy', 'Snacks', 'Cereals', 'Pizza toppings', 'Sandwiches', 'Drinks without alcohol', 'Things in a salad',
  'Restaurants', 'Fast food items', 'Things at a grocery store', 'Things in a bathroom', 'Furniture',
  'Things in a garage', 'Tools', 'Clothing', 'Shoes', 'Things you wear on your head', 'Accessories',
  'Hairstyles', 'Body parts', 'Things in a hospital', 'Things at a zoo', 'Things at a farm',
  'Insects and bugs', 'Birds', 'Fish and sea creatures', 'Reptiles', 'Pets', 'Dog breeds',
  'Flowers', 'Trees', 'Weather words', 'Things in space', 'Things in the sky', 'Things in a forest',
  'Things in a city', 'Famous buildings', 'Vacation spots', 'Languages', 'School subjects', 'Things in a classroom',
  'Things in a backpack', 'Office supplies', 'Things that fly', 'Things that are loud', 'Things that smell bad',
  'Things that smell good', 'Things that are soft', 'Things that are fast', 'Things you can break',
  'Things you can open', 'Things you can throw', 'Things you shout', 'Things you do at a party',
  'Things you do on a road trip', 'Things in a car', 'Car brands', 'Things you see at a wedding',
  'Things you see at a birthday party', 'Holiday words', 'Halloween costumes', 'Christmas things',
  'Things that are green', 'Things that are red', 'Things that are yellow', 'Things that are black',
  'Things you collect', 'Hobbies', 'Things you do when bored', 'Excuses for not doing homework',
  'Words ending in -ing', 'Adjectives for a bad day', 'Compliments',
  'Nicknames', 'Brand names', 'Apps on your phone', 'Websites', 'Things you lose', 'Things with buttons',
  'Things with a screen', 'Things you find in a purse', 'Things at a carnival', 'Camping gear',
  'Things in a hotel room', 'Things at an airport', 'Things you pack for vacation', 'Magic words and spells',
  'Mythical creatures', 'Famous scientists', 'Historical figures', 'Things that are scary',
  'Things a baby does', 'Things grandparents say', 'Things that are old', 'Things that are tiny',
  'Things that are huge', 'Kinds of soup', 'Kinds of cheese', 'Kinds of pasta', 'Spices and seasonings',
  'Things you put on a burger', 'Things at a movie theater', 'Things in a toolbox', 'Things in a gym',
  'Ways to say hello', 'Ways to say goodbye', 'Reasons to cry', 'Reasons to celebrate',
]

const DANCE = [
  'Dance styles', 'Ballet terms', 'Things in a dance bag', 'Excuses for being late to rehearsal',
  'Things a choreographer yells', 'Songs you could dance to', 'Things on a competition weekend',
  'Things that go wrong on stage', 'Costume pieces', 'Things in a dressing room', 'Dance moves',
  'Things a dance mom says', 'Ways to warm up', 'Things that make a solo great', 'Stage directions and stage words',
  'Famous dancers', 'Broadway musicals', 'Things you need for a quick change', 'Reasons to skip leg day (not allowed)',
  'Things that hurt after class', 'Snacks for a long rehearsal', 'Things you hear in the wings',
  'Words to describe a great performance', 'Things on a studio wall', 'Music genres',
  'Things you say before you go on stage', 'Things in a hair and makeup kit', 'Dance movies',
]

const DISNEY = [
  'Disney characters', 'Disney movies', 'Pixar characters', 'Disney villains', 'Disney songs',
  'Things at a Disney park', 'Disney sidekicks', 'Princesses and princes', 'Things in a fairy tale',
  'Animated movies',
]

const FLORIDA = [
  'Things in Florida', 'Florida cities and towns', 'Things that bite in Florida', 'Florida weather events',
  'Things at a theme park', 'Theme park rides', 'Things you see on I-4', 'Things at Publix',
  'Things a Florida Man would do', 'Things in a swamp', 'Things on a boat', 'Beach snacks',
  'Things to do on a rainy afternoon', 'Hurricane supplies', 'Things that melt',
]

const MOVIES_TV = [
  'Movies', 'Movie stars', 'Movie quotes', 'Horror movie things', 'Sequels', 'Reality TV shows',
  'Sitcoms', 'Game shows', 'Famous duos', 'Famous athletes', 'Celebrities', 'Things in a superhero movie',
  'Things in a rom-com', 'Netflix shows', 'Kids shows', 'Fictional places', 'Famous pets and animals from TV',
  'Things a movie villain says', 'Things at an award show', 'Movie snacks', 'Characters with a hat',
]

const SILLY = [
  'Bad names for a pet', 'Terrible gift ideas', 'Things you should not say in a job interview',
  'Things you should not say on a first date', 'Things that would ruin a picnic', 'Weird things to collect',
  'Reasons to be late to work', 'Things you yell at a TV', 'Terrible superpowers', 'Bad names for a band',
  'Things you hide from your parents', 'Things you do in traffic', 'Things you would take to a desert island',
  'Things that keep you up at night', 'Names for a goldfish', 'Things you can do with a noodle',
  'Things that are overrated', 'Things that should be illegal', 'Things you find under the couch',
  'Ways to start a group chat fight', 'Things a pirate says', 'Things a cowboy says', 'Things a robot says',
  'Fake holidays', 'Things you should never microwave', 'Reasons to call in sick', 'Last words before a dare',
  'Things in a villain\'s lair', 'Things a teenager rolls their eyes at', 'Things you do at 2am',
  'Things you say when you stub your toe', 'Ice cream flavors that should exist',
]

/** Every category, deduped. */
export const CATEGORY_BANK: string[] = [...new Set([...CLASSIC, ...DANCE, ...DISNEY, ...FLORIDA, ...MOVIES_TV, ...SILLY])]
