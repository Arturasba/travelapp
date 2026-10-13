import trakai from "../public/trakai.jpg";
import vilnius from "../public/vilnius.jpg";
import forest from "../public/forest.jpg";
import coast from "../public/coast.jpg";

export const chapters = [
  {
    label: "The opening", category: "PROLOGUE", subtitle: "A Baltic state of mind", image: trakai,
    alt: "Trakai Island Castle surrounded by the waters of Lake Galvė", location: "TRAKAI / LAKE GALVĖ", credit: "Hans-Joachim Kaiser", source: "https://unsplash.com/photos/o7CB9eGGtWM",
    title: "A little closer", italic: "to wonder.", intro: "There are places you visit. And places you carry with you.",
    body: "Between the Baltic Sea and a thousand quiet corners, Lithuania waits to be discovered. Not in a hurry. Not all at once. A courtyard, a forest path, a conversation. One page at a time.",
    photoTitle: "Lithuania, slowly.", story: "Start at the water’s edge. Across Lake Galvė, the red towers of Trakai rise between the trees. The boats drift, the reeds stir, and the day begins to feel a little longer.",
    note: "An invitation, not an itinerary.", accent: "#6a7850",
  },
  {
    label: "Cities with a soul", category: "CITIES", subtitle: "The many sides of Vilnius", image: vilnius,
    alt: "Vilnius rooftops and modern architecture beside the Neris River", location: "VILNIUS / THE NERIS RIVER", credit: "Reza Bina", source: "https://unsplash.com/photos/zQVu-O5ZkFY",
    title: "Follow the", italic: "unexpected.", intro: "An old city with a restless, creative heart.",
    body: "Vilnius is best discovered on foot. Old Town lanes open into quiet courtyards, and café conversations spill into the street. Across the river, another side of the city comes into view. Let curiosity decide which bridge to cross.",
    photoTitle: "A city between worlds.", story: "Walk beside the Neris and watch Vilnius change its silhouette. Glass towers, green banks, and older streets belong to the same city. Make a detour. Then make another.",
    note: "Leave an afternoon wonderfully unplanned.", accent: "#9a6248",
  },
  {
    label: "Castles & echoes", category: "CASTLES", subtitle: "Once upon a lake in Trakai", image: trakai,
    alt: "Red-brick castle towers rising above the island at Trakai", location: "TRAKAI / THE ISLAND CASTLE", credit: "Hans-Joachim Kaiser", source: "https://unsplash.com/photos/o7CB9eGGtWM",
    title: "Some stories", italic: "stay with you.", intro: "A bridge across the water. A doorway into another time.",
    body: "Approach Trakai Castle slowly. First the towers appear, then the red walls, then the island itself. Cross the wooden bridge and wander through its courtyards. Afterwards, follow the shore and see the castle from a different angle.",
    photoTitle: "Once upon a lake.", story: "Stay after your castle visit. Find a warm kibinas, choose a bench beside the water, and watch the light move over Lake Galvė. The quieter part of the story is worth your time.",
    note: "The castle is the beginning. The lake is the pause.", accent: "#98734c",
  },
  {
    label: "The quiet wild", category: "NATURE", subtitle: "Forests, lakes & a slower rhythm", image: forest,
    alt: "An aerial view of lakes enclosed by Lithuanian woodland", location: "LITHUANIA / LAKE COUNTRY", credit: "Gantas Vaičiulėnas", source: "https://unsplash.com/photos/pzx_ysETq1s",
    title: "Make room", italic: "for the quiet.", intro: "Nothing asking for your attention. Everything worth noticing.",
    body: "Outside the cities, the story turns green. Forest paths lead to lakeshores, the air changes, and the day begins to follow a gentler rhythm. Take water, a picnic, and a little extra time. You already have everything else you need.",
    photoTitle: "Go where the green goes.", story: "From above, the forest and water look like pieces of a puzzle. On the ground, they become small discoveries: the sound of birds, a ripple on the lake, a path you decide to follow.",
    note: "A slower day is still an adventure.", accent: "#4e7155",
  },
  {
    label: "Where land meets sea", category: "THE COAST", subtitle: "Nida & the Curonian Spit", image: coast,
    alt: "Sand dunes and the water near Nida on Lithuania’s Curonian Spit", location: "NIDA / THE CURONIAN SPIT", credit: "Rolandas S", source: "https://unsplash.com/photos/cPIy3ecjgFI",
    title: "Follow the", italic: "horizon.", intro: "Sand, sea, and a different kind of silence.",
    body: "On the Curonian Spit, the landscape opens out. Walk through pine forest to the Baltic, explore Nida’s streets, and follow marked paths into the dunes. Between the sea and the lagoon, there is room to let your thoughts wander.",
    photoTitle: "At the edge of everything.", story: "The wind redraws the sand. Light travels across the lagoon. Stay on the marked paths, take only photographs, and give this fragile landscape the space it deserves.",
    note: "The book ends here. Your journey doesn’t have to.", accent: "#9a8057",
  },
] as const;

export const totalPages = chapters.length * 2;
