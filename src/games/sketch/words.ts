// Word packs for Sketch. Plain, drawable, no proper nouns in Classic.

export const PACKS: Record<string, { label: string; words: string[] }> = {
  classic: {
    label: 'Classic',
    words: [
      'pizza', 'volcano', 'snowman', 'giraffe', 'toothbrush', 'lighthouse', 'skateboard', 'octopus', 'cactus', 'rainbow',
      'hamburger', 'umbrella', 'ladder', 'dragon', 'robot', 'castle', 'banana', 'tornado', 'mermaid', 'penguin',
      'fireworks', 'spider web', 'roller coaster', 'hot air balloon', 'birthday cake', 'treasure chest', 'pirate ship', 'traffic light', 'alarm clock', 'popcorn',
      'jellyfish', 'cupcake', 'unicorn', 'mailbox', 'campfire', 'helicopter', 'windmill', 'scarecrow', 'igloo', 'kangaroo',
      'flamingo', 'sunflower', 'skeleton', 'vampire', 'ghost', 'haunted house', 'bowling', 'trampoline', 'hammock', 'sandcastle',
      'snail', 'beehive', 'dinosaur', 'astronaut', 'rocket', 'alien', 'satellite', 'black hole', 'telescope', 'microscope',
      'toilet', 'bathtub', 'shower', 'toaster', 'blender', 'vacuum', 'washing machine', 'fridge', 'microwave', 'couch',
      'doorbell', 'staircase', 'chimney', 'fence', 'garden', 'tractor', 'barn', 'pig', 'chicken', 'horse',
      'cowboy', 'lasso', 'wizard', 'magic wand', 'crown', 'king', 'queen', 'knight', 'sword', 'shield',
      'bicycle', 'motorcycle', 'bus', 'train', 'airplane', 'parachute', 'submarine', 'anchor', 'whale', 'shark',
      'crab', 'lobster', 'starfish', 'seashell', 'palm tree', 'coconut', 'pineapple', 'watermelon', 'grapes', 'cherry',
      'ice cream', 'donut', 'taco', 'sushi', 'spaghetti', 'french fries', 'hot dog', 'pancakes', 'waffle', 'cookie',
      'headphones', 'microphone', 'guitar', 'piano', 'drum', 'trumpet', 'violin', 'disco ball', 'jukebox', 'radio',
      'camera', 'television', 'remote', 'video game', 'joystick', 'laptop', 'phone', 'selfie', 'emoji', 'wifi',
      'sunglasses', 'flip flops', 'high heels', 'sneakers', 'backpack', 'suitcase', 'passport', 'map', 'compass', 'tent',
      'mountain', 'waterfall', 'island', 'desert', 'jungle', 'swamp', 'cave', 'river', 'bridge', 'tunnel',
      'thunderstorm', 'lightning', 'snowflake', 'tornado warning', 'sunburn', 'mosquito', 'alligator', 'frog', 'turtle', 'owl',
      'bat', 'raccoon', 'squirrel', 'hedgehog', 'sloth', 'panda', 'koala', 'zebra', 'elephant', 'monkey',
      'mustache', 'beard', 'bald', 'braces', 'tattoo', 'pajamas', 'sleepwalking', 'snoring', 'yawning', 'sneezing',
      'zombie', 'werewolf', 'superhero', 'cape', 'mask', 'ninja', 'pirate', 'princess', 'clown', 'magician',
    ],
  },
  movies: {
    label: 'Movies',
    words: [
      'Jaws', 'Titanic', 'Frozen', 'Shrek', 'Up', 'Cars', 'Toy Story', 'Finding Nemo', 'The Lion King', 'Aladdin',
      'Moana', 'Encanto', 'Coco', 'Inside Out', 'Ratatouille', 'Wall-E', 'Monsters Inc', 'The Incredibles', 'Zootopia', 'Tangled',
      'Star Wars', 'Jurassic Park', 'Ghostbusters', 'Back to the Future', 'E.T.', 'Home Alone', 'The Wizard of Oz', 'Mean Girls', 'Clueless', 'Grease',
      'Twister', 'Godzilla', 'King Kong', 'Barbie', 'Wicked', 'The Little Mermaid', 'Beauty and the Beast', 'Cinderella', 'Mulan', 'Hercules',
      'Spider-Man', 'Batman', 'Superman', 'Black Panther', 'Avengers', 'The Matrix', 'Inception', 'Gravity', 'Interstellar', 'Avatar',
      'Harry Potter', 'Lord of the Rings', 'The Hunger Games', 'Twilight', 'Pirates of the Caribbean', 'Jumanji', 'Night at the Museum', 'Ice Age', 'Madagascar', 'Kung Fu Panda',
      'Dirty Dancing', 'Footloose', 'Step Up', 'Black Swan', 'La La Land', 'Chicago', 'Hairspray', 'Mamma Mia', 'The Greatest Showman', 'Flashdance',
    ],
  },
  dance: {
    label: 'Dance',
    words: [
      'pirouette', 'fouette', 'grand jete', 'plie', 'arabesque', 'tour jete', 'chaine turns', 'leap', 'split', 'cartwheel',
      'barre', 'pointe shoes', 'tutu', 'leotard', 'tap shoes', 'jazz hands', 'shuffle ball change', 'moonwalk', 'worm', 'robot dance',
      'spotlight', 'curtain call', 'bow', 'standing ovation', 'stage fright', 'costume', 'quick change', 'rhinestones', 'trophy', 'judges',
      'audition', 'warm up', 'stretching', 'eight count', 'mirror', 'competition', 'solo', 'duet', 'trio', 'kick line',
      'hair bun', 'bobby pins', 'false eyelashes', 'spray tan', 'dance bag', 'ice pack', 'sprained ankle', 'foam roller', 'recital', 'backstage',
    ],
  },
}

export const PACK_OPTIONS = Object.entries(PACKS).map(([value, p]) => ({ value, label: p.label }))
