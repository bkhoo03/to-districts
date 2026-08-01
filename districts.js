// Downtown Toronto Districts / Neighbourhoods
// Boundaries built on a grid of real streets to guarantee NO overlaps.
// Each district is a rectangle defined by [north, south, west, east].

// ---- Street reference lines (latitude, north -> south) ----
const LAT = {
    BLOOR:    43.6705,
    CHARLES:  43.6660,
    COLLEGE:  43.6615,
    GERRARD:  43.6575,
    DUNDAS:   43.6555,
    SHUTER:   43.6525,
    QUEEN:    43.6510,
    FRONT:    43.6450,
    RAIL:     43.6410,
    QUAY:     43.6395,
    LAKE:     43.6355
};

// ---- Street reference lines (longitude, west -> east) ----
const LNG = {
    OSSINGTON:  -79.4180,
    BATHURST:   -79.4110,
    SPADINA:    -79.3990,
    UNIVERSITY: -79.3890,
    BAY:        -79.3835,
    YONGE:      -79.3800,
    JARVIS:     -79.3720,
    PARLIAMENT: -79.3660,
    BERKELEY:   -79.3610,
    DON:        -79.3555,
    // waterfront helpers
    CITY_W:     -79.4020,
    FORT_W:     -79.4130
};

// Helper: build a rectangle polygon + its true centre from bounds
function rect(n, s, w, e) {
    return {
        coordinates: [[n, w], [n, e], [s, e], [s, w]],
        center: [(n + s) / 2, (w + e) / 2]
    };
}

// Raw district definitions (disjoint rectangles)
const DISTRICT_DEFS = [
    {
        name: "Annex - U of T", color: "#1abc9c",
        bounds: [LAT.BLOOR, LAT.COLLEGE, LNG.BATHURST, LNG.UNIVERSITY],
        description: "The University of Toronto's St. George campus and the leafy Annex. Victorian homes, bookshops, student pubs, and Bloor St W dining.",
        highlights: ["U of T St. George", "Robarts Library", "Hart House", "Bloor St W", "Lee's Palace"]
    },
    {
        name: "Yorkville", color: "#a29bfe",
        bounds: [LAT.BLOOR, LAT.CHARLES, LNG.UNIVERSITY, LNG.YONGE],
        description: "Upscale shopping and dining. The 'Mink Mile' on Bloor St, designer boutiques, galleries, and luxury hotels.",
        highlights: ["Mink Mile", "Royal Ontario Museum", "Yorkville Village", "Bata Shoe Museum"]
    },
    {
        name: "Yonge and Bloor", color: "#74b9ff",
        bounds: [LAT.BLOOR, LAT.CHARLES, LNG.YONGE, LNG.JARVIS],
        description: "The crossroads of Toronto's two main streets and a major transit hub at Bloor-Yonge station.",
        highlights: ["Bloor-Yonge Station", "Hudson's Bay", "Yonge St shops"]
    },
    {
        name: "St. James Town", color: "#fdcb6e",
        bounds: [LAT.BLOOR, LAT.COLLEGE, LNG.JARVIS, LNG.PARLIAMENT],
        description: "One of Canada's most densely populated neighbourhoods — high-rise apartments and a diverse, multicultural community.",
        highlights: ["High-density living", "Wellesley Community Centre", "Diverse food"]
    },
    {
        name: "Cabbagetown", color: "#6c5ce7",
        bounds: [LAT.BLOOR, LAT.GERRARD, LNG.PARLIAMENT, LNG.DON],
        description: "Charming district with the largest collection of preserved Victorian homes in North America. Riverdale Farm and tree-lined streets.",
        highlights: ["Victorian homes", "Riverdale Farm", "Parliament St", "Carlton St"]
    },
    {
        name: "Bay St. Corridor", color: "#8395a7",
        bounds: [LAT.CHARLES, LAT.DUNDAS, LNG.UNIVERSITY, LNG.YONGE],
        description: "Northern extension of the Financial District. Condos, offices, College Park, hospitals, MaRS, and Queen's Park.",
        highlights: ["MaRS Centre", "College Park", "Toronto General Hospital", "Queen's Park"]
    },
    {
        name: "Church St. Corridor", color: "#fd79a8",
        bounds: [LAT.CHARLES, LAT.DUNDAS, LNG.YONGE, LNG.JARVIS],
        description: "Toronto's vibrant LGBTQ+ Village. Rainbow crosswalks, inclusive bars, theatres, and community events year-round.",
        highlights: ["The Village", "Pride Toronto", "Barbara Hall Park", "Glad Day Bookshop"]
    },
    {
        name: "Little Italy", color: "#00cec9",
        bounds: [LAT.COLLEGE, LAT.DUNDAS, LNG.OSSINGTON, LNG.BATHURST],
        description: "College St west of Bathurst — Italian cafes, trattorias, gelato, and a buzzing summer patio scene.",
        highlights: ["College St patios", "Bar Raval", "Cafe Diplomatico", "Gelato"]
    },
    {
        name: "Kensington Market", color: "#f39c12",
        bounds: [LAT.COLLEGE, LAT.DUNDAS, LNG.BATHURST, LNG.SPADINA],
        description: "Eclectic, bohemian market with vintage shops, global street food, street art, and Pedestrian Sundays in summer.",
        highlights: ["Vintage shops", "Street food", "Augusta Ave", "Pedestrian Sundays"]
    },
    {
        name: "Chinatown", color: "#e94560",
        bounds: [LAT.COLLEGE, LAT.DUNDAS, LNG.SPADINA, LNG.UNIVERSITY],
        description: "Centred on Spadina & Dundas. Dim sum restaurants, herbal shops, fresh markets, and Chinese bakeries.",
        highlights: ["Spadina Ave", "Dim Sum", "Dragon City Mall", "Chinese bakeries"]
    },
    {
        name: "Moss Park", color: "#ff7675",
        bounds: [LAT.COLLEGE, LAT.QUEEN, LNG.JARVIS, LNG.PARLIAMENT],
        description: "Between Jarvis and Parliament, Queen to Carlton. Home to the Moss Park Armoury and undergoing revitalization.",
        highlights: ["Moss Park Armoury", "George Brown College", "Queen St E"]
    },
    {
        name: "Regent Park", color: "#e84393",
        bounds: [LAT.GERRARD, LAT.QUEEN, LNG.PARLIAMENT, LNG.DON],
        description: "A landmark revitalization — new mixed-income housing, an aquatic centre, and the Daniels Spectrum arts hub.",
        highlights: ["Aquatic Centre", "Daniels Spectrum", "Community gardens"]
    },
    {
        name: "Alexandra Park", color: "#e17055",
        bounds: [LAT.DUNDAS, LAT.QUEEN, LNG.BATHURST, LNG.SPADINA],
        description: "Residential neighbourhood bounded by Dundas, Spadina, Queen, and Bathurst, next to Chinatown and Queen West.",
        highlights: ["Alexandra Park", "Community housing", "Near Chinatown"]
    },
    {
        name: "Grange Park", color: "#00b894",
        bounds: [LAT.DUNDAS, LAT.QUEEN, LNG.SPADINA, LNG.UNIVERSITY],
        description: "Anchored by the Art Gallery of Ontario and OCAD University — a hub of art institutions and student life.",
        highlights: ["Art Gallery of Ontario", "OCAD University", "Grange Park"]
    },
    {
        name: "The Core", color: "#0984e3",
        bounds: [LAT.DUNDAS, LAT.QUEEN, LNG.UNIVERSITY, LNG.JARVIS],
        description: "The beating heart of downtown — Yonge-Dundas Square, the Eaton Centre, Nathan Phillips Square, City Hall, and TMU.",
        highlights: ["Yonge-Dundas Square", "Eaton Centre", "Nathan Phillips Square", "City Hall", "TMU"]
    },
    {
        name: "Queen West", color: "#e056a0",
        bounds: [LAT.QUEEN, LAT.FRONT, LNG.OSSINGTON, LNG.SPADINA],
        description: "Independent boutiques, galleries, and bars. Graffiti Alley, Trinity Bellwoods Park, and Toronto's creative pulse.",
        highlights: ["Queen St W", "Graffiti Alley", "Trinity Bellwoods", "Drake Hotel"]
    },
    {
        name: "King West", color: "#9b59b6",
        bounds: [LAT.QUEEN, LAT.FRONT, LNG.SPADINA, LNG.UNIVERSITY],
        description: "Trendy nightlife and dining along King St W — former garment factories turned into lofts, hotels, and bars.",
        highlights: ["King St W", "Nightlife", "TIFF Bell Lightbox", "Restaurants"]
    },
    {
        name: "Entertainment District", color: "#c56cf0",
        bounds: [LAT.QUEEN, LAT.RAIL, LNG.UNIVERSITY, LNG.BAY],
        description: "Major venues and nightlife — CN Tower, Rogers Centre, Scotiabank Arena, Ripley's Aquarium, and the theatre cluster.",
        highlights: ["CN Tower", "Rogers Centre", "Scotiabank Arena", "Ripley's Aquarium", "Theatres"]
    },
    {
        name: "Financial District", color: "#3498db",
        bounds: [LAT.QUEEN, LAT.FRONT, LNG.BAY, LNG.JARVIS],
        description: "Canada's banking centre — skyscrapers, the 30km PATH underground network, Union Station, and Bay Street.",
        highlights: ["Bay Street", "PATH network", "Union Station", "TD Centre"]
    },
    {
        name: "St. Lawrence", color: "#e67e22",
        bounds: [LAT.QUEEN, LAT.FRONT, LNG.JARVIS, LNG.PARLIAMENT],
        description: "Historic district home to the famous St. Lawrence Market, the Flatiron Building, and heritage architecture.",
        highlights: ["St. Lawrence Market", "Flatiron Building", "Berczy Park", "The Esplanade"]
    },
    {
        name: "Corktown", color: "#fdd835",
        bounds: [LAT.QUEEN, LAT.FRONT, LNG.PARLIAMENT, LNG.BERKELEY],
        description: "One of Toronto's oldest areas, revitalized with the West Don Lands, new parks, and condos.",
        highlights: ["Corktown Common", "West Don Lands", "Underpass Park"]
    },
    {
        name: "Distillery District", color: "#fab1a0",
        bounds: [LAT.QUEEN, LAT.FRONT, LNG.BERKELEY, LNG.DON],
        description: "Preserved Victorian industrial architecture, now pedestrian-only cobblestone streets with galleries, breweries, and the Christmas Market.",
        highlights: ["Cobblestone streets", "Craft breweries", "Christmas Market", "Galleries"]
    },
    {
        name: "CityPlace", color: "#00b4d8",
        bounds: [LAT.FRONT, LAT.QUAY, LNG.CITY_W, LNG.UNIVERSITY],
        description: "A modern condo community on former rail lands — high-rise towers, Canoe Landing Park, and quick access to the waterfront.",
        highlights: ["Canoe Landing Park", "Puente de Luz bridge", "Modern condos"]
    },
    {
        name: "Fort York", color: "#95a5a6",
        bounds: [LAT.RAIL, LAT.QUAY, LNG.FORT_W, LNG.CITY_W],
        description: "The 1793 Fort York National Historic Site surrounded by new residential development and the Bentway under the Gardiner.",
        highlights: ["Fort York NHS", "The Bentway", "Garrison Crossing"]
    },
    {
        name: "The Waterfront", color: "#0077b6",
        bounds: [LAT.RAIL, LAT.LAKE, LNG.UNIVERSITY, LNG.DON],
        description: "The lakeside strip along Queens Quay — Harbourfront Centre, the Toronto Islands ferry, galleries, and scenic paths.",
        highlights: ["Harbourfront Centre", "Islands Ferry", "Queens Quay", "Music Garden"]
    }
];

// Build final DISTRICTS with coordinates + centres
const DISTRICTS = DISTRICT_DEFS.map(d => {
    const r = rect(d.bounds[0], d.bounds[1], d.bounds[2], d.bounds[3]);
    return {
        name: d.name,
        color: d.color,
        description: d.description,
        highlights: d.highlights,
        coordinates: r.coordinates,
        center: r.center
    };
});

// ---- TTC Subway LINES (accurate paths for drawing) ----
// Line 1 (Yonge-University-Spadina) — Yellow, U-shaped
// Line 2 (Bloor-Danforth) — Green, east-west along Bloor/Danforth (~43.66 lat)
const SUBWAY_LINES = {
    line1: {
        color: "#f8c300",
        name: "Line 1 — Yonge-University-Spadina",
        // U-shape: north on Spadina side → south to Union → north on Yonge side
        path: [
            // Spadina/University arm (north to south)
            [43.6840, -79.4150], // St. Clair West
            [43.6748, -79.4067], // Dupont
            [43.6673, -79.4036], // Spadina (Bloor)
            [43.6683, -79.3997], // St. George
            [43.6677, -79.3937], // Museum
            [43.6610, -79.3906], // Queen's Park
            [43.6558, -79.3886], // St. Patrick
            [43.6511, -79.3876], // Osgoode
            [43.6476, -79.3847], // St. Andrew
            [43.6453, -79.3806], // Union (bottom of U)
            // Yonge arm (south to north)
            [43.6490, -79.3783], // King
            [43.6523, -79.3793], // Queen
            [43.6561, -79.3802], // Dundas
            [43.6614, -79.3830], // College
            [43.6655, -79.3838], // Wellesley
            [43.6709, -79.3858], // Bloor-Yonge
            [43.6786, -79.3783], // Rosedale
            [43.6821, -79.3791], // Summerhill
            [43.6860, -79.3827], // St. Clair
            [43.6902, -79.3831], // Davisville
            [43.6945, -79.3871]  // Eglinton
        ]
    },
    line2: {
        color: "#00923f",
        name: "Line 2 — Bloor-Danforth",
        // Runs approximately east-west along Bloor St / Danforth Ave
        path: [
            [43.6365, -79.5375], // Kipling
            [43.6453, -79.5245], // Islington
            [43.6484, -79.5113], // Royal York
            [43.6500, -79.4950], // Old Mill
            [43.6500, -79.4849], // Jane
            [43.6532, -79.4751], // Runnymede
            [43.6543, -79.4666], // High Park
            [43.6557, -79.4596], // Keele
            [43.6571, -79.4525], // Dundas West
            [43.6590, -79.4424], // Lansdowne
            [43.6600, -79.4347], // Dufferin
            [43.6624, -79.4262], // Ossington
            [43.6642, -79.4186], // Christie
            [43.6652, -79.4113], // Bathurst
            [43.6673, -79.4036], // Spadina
            [43.6683, -79.3997], // St. George
            [43.6700, -79.3901], // Bay
            [43.6709, -79.3858], // Bloor-Yonge
            [43.6722, -79.3766], // Sherbourne
            [43.6738, -79.3685], // Castle Frank
            [43.6768, -79.3587], // Broadview
            [43.6785, -79.3518], // Chester
            [43.6798, -79.3457], // Pape
            [43.6817, -79.3379], // Donlands
            [43.6831, -79.3302], // Greenwood
            [43.6837, -79.3213], // Coxwell
            [43.6854, -79.3111], // Woodbine
            [43.6862, -79.3020], // Main Street
            [43.6882, -79.2875], // Victoria Park
            [43.6919, -79.2796]  // Warden
        ]
    }
};

// ---- TTC Subway stations ----
const SUBWAY_STATIONS = [
    // Line 1 — University/Spadina arm (north to south)
    { name: "St. Clair West", lat: 43.6840, lng: -79.4150, line: "1" },
    { name: "Dupont", lat: 43.6748, lng: -79.4067, line: "1" },
    { name: "Spadina", lat: 43.6673, lng: -79.4036, line: "1 & 2" },
    { name: "St. George", lat: 43.6683, lng: -79.3997, line: "1 & 2" },
    { name: "Museum", lat: 43.6677, lng: -79.3937, line: "1" },
    { name: "Queen's Park", lat: 43.6610, lng: -79.3906, line: "1" },
    { name: "St. Patrick", lat: 43.6558, lng: -79.3886, line: "1" },
    { name: "Osgoode", lat: 43.6511, lng: -79.3876, line: "1" },
    { name: "St. Andrew", lat: 43.6476, lng: -79.3847, line: "1" },
    { name: "Union", lat: 43.6453, lng: -79.3806, line: "1" },
    // Line 1 — Yonge arm (south to north)
    { name: "King", lat: 43.6490, lng: -79.3783, line: "1" },
    { name: "Queen", lat: 43.6523, lng: -79.3793, line: "1" },
    { name: "Dundas", lat: 43.6561, lng: -79.3802, line: "1" },
    { name: "College", lat: 43.6614, lng: -79.3830, line: "1" },
    { name: "Wellesley", lat: 43.6655, lng: -79.3838, line: "1" },
    { name: "Bloor-Yonge", lat: 43.6709, lng: -79.3858, line: "1 & 2" },
    { name: "Rosedale", lat: 43.6786, lng: -79.3783, line: "1" },
    { name: "Summerhill", lat: 43.6821, lng: -79.3791, line: "1" },
    { name: "St. Clair", lat: 43.6860, lng: -79.3827, line: "1" },
    { name: "Davisville", lat: 43.6902, lng: -79.3831, line: "1" },
    { name: "Eglinton", lat: 43.6945, lng: -79.3871, line: "1" },
    // Line 2 — west to east
    { name: "Dundas West", lat: 43.6571, lng: -79.4525, line: "2" },
    { name: "Lansdowne", lat: 43.6590, lng: -79.4424, line: "2" },
    { name: "Dufferin", lat: 43.6600, lng: -79.4347, line: "2" },
    { name: "Ossington", lat: 43.6624, lng: -79.4262, line: "2" },
    { name: "Christie", lat: 43.6642, lng: -79.4186, line: "2" },
    { name: "Bathurst", lat: 43.6652, lng: -79.4113, line: "2" },
    { name: "Bay", lat: 43.6700, lng: -79.3901, line: "2" },
    { name: "Sherbourne", lat: 43.6722, lng: -79.3766, line: "2" },
    { name: "Castle Frank", lat: 43.6738, lng: -79.3685, line: "2" },
    { name: "Broadview", lat: 43.6768, lng: -79.3587, line: "2" },
    { name: "Chester", lat: 43.6785, lng: -79.3518, line: "2" },
    { name: "Pape", lat: 43.6798, lng: -79.3457, line: "2" },
    { name: "Donlands", lat: 43.6817, lng: -79.3379, line: "2" },
    { name: "Greenwood", lat: 43.6831, lng: -79.3302, line: "2" },
    { name: "Coxwell", lat: 43.6837, lng: -79.3213, line: "2" }
];

// ---- Points of Interest, grouped by clean categories ----
// categories drive the marker colour (see CATEGORIES below)
const POI_CATEGORIES = {
    education: { color: "#58a6ff", label: "Education" },
    culture:   { color: "#bc8cff", label: "Arts & Culture" },
    landmark:  { color: "#ff7b72", label: "Landmark" },
    market:    { color: "#ffa657", label: "Market & Food" },
    park:      { color: "#3fb950", label: "Park & Green" },
    uoft:      { color: "#002a5c", label: "U of T Campus" }
};

const POINTS_OF_INTEREST = [
    { name: "University of Toronto (St. George)", lat: 43.6629, lng: -79.3957, district: "Annex - U of T", cat: "education" },
    { name: "Robarts Library", lat: 43.6645, lng: -79.3997, district: "Annex - U of T", cat: "education" },
    { name: "Hart House", lat: 43.6635, lng: -79.3942, district: "Annex - U of T", cat: "education" },
    { name: "OCAD University", lat: 43.6531, lng: -79.3910, district: "Grange Park", cat: "education" },
    { name: "Toronto Metropolitan University (TMU)", lat: 43.6577, lng: -79.3788, district: "The Core", cat: "education" },
    { name: "George Brown College", lat: 43.6510, lng: -79.3710, district: "Moss Park", cat: "education" },
    { name: "CN Tower", lat: 43.6426, lng: -79.3871, district: "Entertainment District", cat: "landmark" },
    { name: "Rogers Centre", lat: 43.6414, lng: -79.3894, district: "Entertainment District", cat: "landmark" },
    { name: "Scotiabank Arena", lat: 43.6435, lng: -79.3791, district: "Financial District", cat: "landmark" },
    { name: "Union Station", lat: 43.6453, lng: -79.3806, district: "Financial District", cat: "landmark" },
    { name: "Nathan Phillips Square (City Hall)", lat: 43.6525, lng: -79.3834, district: "The Core", cat: "landmark" },
    { name: "Fort York National Historic Site", lat: 43.6387, lng: -79.4057, district: "Fort York", cat: "landmark" },
    { name: "Flatiron Building", lat: 43.6488, lng: -79.3745, district: "St. Lawrence", cat: "landmark" },
    { name: "Royal Ontario Museum (ROM)", lat: 43.6677, lng: -79.3948, district: "Yorkville", cat: "culture" },
    { name: "Art Gallery of Ontario (AGO)", lat: 43.6536, lng: -79.3925, district: "Grange Park", cat: "culture" },
    { name: "TIFF Bell Lightbox", lat: 43.6464, lng: -79.3905, district: "King West", cat: "culture" },
    { name: "Harbourfront Centre", lat: 43.6388, lng: -79.3822, district: "The Waterfront", cat: "culture" },
    { name: "Daniels Spectrum", lat: 43.6590, lng: -79.3600, district: "Regent Park", cat: "culture" },
    { name: "Ripley's Aquarium", lat: 43.6424, lng: -79.3860, district: "Entertainment District", cat: "culture" },
    { name: "Distillery District", lat: 43.6503, lng: -79.3596, district: "Distillery District", cat: "culture" },
    { name: "St. Lawrence Market", lat: 43.6487, lng: -79.3715, district: "St. Lawrence", cat: "market" },
    { name: "Kensington Market", lat: 43.6547, lng: -79.4005, district: "Kensington Market", cat: "market" },
    { name: "Chinatown (Spadina & Dundas)", lat: 43.6527, lng: -79.3972, district: "Chinatown", cat: "market" },
    { name: "Toronto Eaton Centre", lat: 43.6544, lng: -79.3807, district: "The Core", cat: "market" },
    { name: "Trinity Bellwoods Park", lat: 43.6470, lng: -79.4138, district: "Queen West", cat: "park" },
    { name: "Allan Gardens Conservatory", lat: 43.6611, lng: -79.3745, district: "Church St. Corridor", cat: "park" },
    { name: "Canoe Landing Park", lat: 43.6382, lng: -79.3970, district: "CityPlace", cat: "park" },
    { name: "Corktown Common", lat: 43.6535, lng: -79.3540, district: "Corktown", cat: "park" },
    { name: "The Bentway", lat: 43.6380, lng: -79.4020, district: "Fort York", cat: "park" },
    { name: "Queen's Park", lat: 43.6603, lng: -79.3924, district: "Bay St. Corridor", cat: "park" }
];

// ---- U of T St. George Campus ----
// Key buildings/locations as POIs in the "uoft" category
const UOFT_CAMPUS_POIS = [
    { name: "Robarts Library", lat: 43.6645, lng: -79.3997, cat: "uoft" },
    { name: "Bahen Centre (CS/Math)", lat: 43.6596, lng: -79.3974, cat: "uoft" },
    { name: "Sidney Smith Hall", lat: 43.6622, lng: -79.3981, cat: "uoft" },
    { name: "Hart House", lat: 43.6635, lng: -79.3942, cat: "uoft" },
    { name: "King's College Circle", lat: 43.6610, lng: -79.3957, cat: "uoft" },
    { name: "Myhal Centre (Engineering)", lat: 43.6609, lng: -79.3951, cat: "uoft" },
    { name: "Gerstein Science Library", lat: 43.6621, lng: -79.3946, cat: "uoft" },
    { name: "Medical Sciences Building", lat: 43.6607, lng: -79.3928, cat: "uoft" },
    { name: "University College", lat: 43.6617, lng: -79.3960, cat: "uoft" },
    { name: "Knox College", lat: 43.6605, lng: -79.3990, cat: "uoft" },
    { name: "Innis College", lat: 43.6653, lng: -79.3993, cat: "uoft" },
    { name: "New College", lat: 43.6588, lng: -79.3996, cat: "uoft" },
    { name: "Victoria College", lat: 43.6650, lng: -79.3926, cat: "uoft" },
    { name: "Trinity College", lat: 43.6645, lng: -79.3970, cat: "uoft" },
    { name: "St. Michael's College", lat: 43.6637, lng: -79.3897, cat: "uoft" },
    { name: "Varsity Stadium", lat: 43.6665, lng: -79.3981, cat: "uoft" },
    { name: "Athletic Centre", lat: 43.6601, lng: -79.3994, cat: "uoft" },
    { name: "Goldring Centre (Kinesiology)", lat: 43.6601, lng: -79.3936, cat: "uoft" },
    { name: "Rotman School of Management", lat: 43.6590, lng: -79.3974, cat: "uoft" },
    { name: "OISE (Education)", lat: 43.6678, lng: -79.3992, cat: "uoft" },
    { name: "Exam Centre", lat: 43.6595, lng: -79.3930, cat: "uoft" },
    { name: "Sandford Fleming (Engineering)", lat: 43.6603, lng: -79.3945, cat: "uoft" },
    { name: "Earth Sciences Centre", lat: 43.6608, lng: -79.3997, cat: "uoft" },
    { name: "Philosopher's Walk", lat: 43.6666, lng: -79.3950, cat: "uoft" },
    { name: "Graduate House", lat: 43.6636, lng: -79.4012, cat: "uoft" }
];

// Add UofT POIs to the main list
POINTS_OF_INTEREST.push(...UOFT_CAMPUS_POIS.map(p => ({ ...p, district: "Annex - U of T" })));

// Campus boundary polygon (approximate — Bloor to College, Spadina to Queen's Park Cr)
const UOFT_CAMPUS_BOUNDARY = [
    [43.6705, -79.4020], // Bloor & Spadina (NW)
    [43.6705, -79.3890], // Bloor & University (NE)
    [43.6590, -79.3890], // College & University (SE)
    [43.6590, -79.4020], // College & Spadina (SW)
];
