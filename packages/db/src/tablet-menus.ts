/**
 * Menus for vendors in `posMode: "tablet"` (no POS). The api's TabletAdapter serves these
 * by vendor slug. All items are fictional.
 */
export interface TabletMenuItem {
  posItemId: string;
  name: string;
  description: string;
  category: string;
  priceMinor: number;
}

export const TABLET_MENUS: Record<string, TabletMenuItem[]> = {
  "burger-lab": [
    { posItemId: "bl_001", name: "Classic smash burger", description: "Double smashed beef, cheddar, pickles, lab sauce.", category: "Burgers", priceMinor: 3200 },
    { posItemId: "bl_002", name: "Crispy chicken burger", description: "Buttermilk chicken, slaw, chipotle mayo.", category: "Burgers", priceMinor: 2900 },
    { posItemId: "bl_003", name: "Mushroom swiss burger", description: "Beef, sautéed mushrooms, swiss, truffle mayo.", category: "Burgers", priceMinor: 3500 },
    { posItemId: "bl_004", name: "Veggie lab burger", description: "Black bean patty, avocado, pickled onion.", category: "Burgers", priceMinor: 2700 },
    { posItemId: "bl_005", name: "Loaded fries", description: "Cheese sauce, jalapeños, crispy onions.", category: "Sides", priceMinor: 1800 },
    { posItemId: "bl_006", name: "Onion rings", description: "Beer-battered, smoky dip.", category: "Sides", priceMinor: 1400 },
    { posItemId: "bl_007", name: "Chicken wings (6)", description: "Buffalo or honey garlic.", category: "Sides", priceMinor: 2400 },
    { posItemId: "bl_008", name: "Vanilla milkshake", description: "Thick, real vanilla.", category: "Shakes", priceMinor: 1900 },
    { posItemId: "bl_009", name: "Salted caramel shake", description: "Caramel, sea salt, whipped cream.", category: "Shakes", priceMinor: 2100 },
    { posItemId: "bl_010", name: "Soft drink", description: "Cola, lemon-lime or orange.", category: "Drinks", priceMinor: 700 },
  ],
  // Marina Night Market (demo venue 2)
  "taco-wagon": [
    { posItemId: "tw_001", name: "Birria tacos (3)", description: "Slow-braised beef, consommé for dipping.", category: "Tacos", priceMinor: 3400 },
    { posItemId: "tw_002", name: "Chicken tinga tacos (3)", description: "Chipotle chicken, crema, pickled onion.", category: "Tacos", priceMinor: 2900 },
    { posItemId: "tw_003", name: "Cauliflower tacos (3)", description: "Roasted cauliflower, salsa verde, pepitas.", category: "Tacos", priceMinor: 2600 },
    { posItemId: "tw_004", name: "Loaded nachos", description: "Black beans, cheese, guac, jalapeños.", category: "Sides", priceMinor: 2400 },
    { posItemId: "tw_005", name: "Elote cup", description: "Charred corn, lime mayo, cotija.", category: "Sides", priceMinor: 1500 },
    { posItemId: "tw_006", name: "Horchata", description: "Cinnamon rice milk, iced.", category: "Drinks", priceMinor: 1200 },
  ],
  "dim-sum-den": [
    { posItemId: "dd_001", name: "Har gow (4)", description: "Prawn dumplings, crystal wrapper.", category: "Steamed", priceMinor: 2200 },
    { posItemId: "dd_002", name: "Chicken siu mai (4)", description: "Open-top dumplings, shiitake.", category: "Steamed", priceMinor: 1900 },
    { posItemId: "dd_003", name: "Xiao long bao (6)", description: "Soup dumplings, black vinegar.", category: "Steamed", priceMinor: 2600 },
    { posItemId: "dd_004", name: "Crispy spring rolls (4)", description: "Vegetable, sweet chilli.", category: "Fried", priceMinor: 1600 },
    { posItemId: "dd_005", name: "Sesame prawn toast", description: "Golden fried, spicy mayo.", category: "Fried", priceMinor: 1800 },
    { posItemId: "dd_006", name: "Jasmine tea", description: "Hot pot for one.", category: "Drinks", priceMinor: 900 },
  ],
  "churro-cart": [
    { posItemId: "cc_001", name: "Classic churros (5)", description: "Cinnamon sugar, chocolate dip.", category: "Churros", priceMinor: 1800 },
    { posItemId: "cc_002", name: "Dulce de leche churros", description: "Filled, caramel drizzle.", category: "Churros", priceMinor: 2200 },
    { posItemId: "cc_003", name: "Churro sundae", description: "Vanilla soft serve, churro bits.", category: "Desserts", priceMinor: 2400 },
    { posItemId: "cc_004", name: "Spanish hot chocolate", description: "Thick, for dipping.", category: "Drinks", priceMinor: 1400 },
  ],
  // Downtown Street Eats (demo venue 3)
  "pizza-slice": [
    { posItemId: "ps_001", name: "Margherita slice", description: "San Marzano, fior di latte, basil.", category: "Slices", priceMinor: 1500 },
    { posItemId: "ps_002", name: "Pepperoni slice", description: "Beef pepperoni, hot honey.", category: "Slices", priceMinor: 1800 },
    { posItemId: "ps_003", name: "Truffle mushroom slice", description: "White base, mushrooms, truffle oil.", category: "Slices", priceMinor: 2000 },
    { posItemId: "ps_004", name: "Garlic knots (4)", description: "Parmesan, parsley butter.", category: "Sides", priceMinor: 1200 },
    { posItemId: "ps_005", name: "Caesar salad", description: "Romaine, croutons, parmesan.", category: "Sides", priceMinor: 2200 },
    { posItemId: "ps_006", name: "San Pellegrino", description: "Lemon or blood orange.", category: "Drinks", priceMinor: 900 },
  ],
  "curry-house": [
    { posItemId: "ch_001", name: "Butter chicken", description: "Creamy tomato gravy, steamed rice.", category: "Curries", priceMinor: 3600 },
    { posItemId: "ch_002", name: "Lamb rogan josh", description: "Kashmiri chilli, slow-cooked lamb.", category: "Curries", priceMinor: 4200 },
    { posItemId: "ch_003", name: "Paneer tikka masala", description: "Charred paneer, rich masala.", category: "Curries", priceMinor: 3200 },
    { posItemId: "ch_004", name: "Garlic naan", description: "Tandoor-baked.", category: "Breads", priceMinor: 800 },
    { posItemId: "ch_005", name: "Samosa chaat", description: "Chickpeas, yoghurt, tamarind.", category: "Starters", priceMinor: 1800 },
    { posItemId: "ch_006", name: "Mango lassi", description: "Yoghurt, Alphonso mango.", category: "Drinks", priceMinor: 1300 },
  ],
  "poke-bowl-co": [
    { posItemId: "pb_001", name: "Salmon poke bowl", description: "Sushi rice, edamame, avocado, ponzu.", category: "Bowls", priceMinor: 4200 },
    { posItemId: "pb_002", name: "Spicy tuna bowl", description: "Sriracha mayo, cucumber, nori.", category: "Bowls", priceMinor: 4400 },
    { posItemId: "pb_003", name: "Tofu bowl", description: "Sesame tofu, kale, pickled ginger.", category: "Bowls", priceMinor: 3400 },
    { posItemId: "pb_004", name: "Miso soup", description: "Tofu, wakame, spring onion.", category: "Sides", priceMinor: 900 },
    { posItemId: "pb_005", name: "Coconut water", description: "Fresh, chilled.", category: "Drinks", priceMinor: 1100 },
  ],
  "bean-bar": [
    { posItemId: "bb_001", name: "Flat white", description: "Double ristretto, steamed milk.", category: "Coffee", priceMinor: 1600 },
    { posItemId: "bb_002", name: "Iced Spanish latte", description: "Condensed milk, espresso, ice.", category: "Coffee", priceMinor: 1900 },
    { posItemId: "bb_003", name: "Matcha latte", description: "Ceremonial grade, oat milk.", category: "Coffee", priceMinor: 2000 },
    { posItemId: "bb_004", name: "Almond croissant", description: "Twice-baked, frangipane.", category: "Bakery", priceMinor: 1500 },
    { posItemId: "bb_005", name: "Banana bread", description: "Walnuts, brown butter.", category: "Bakery", priceMinor: 1200 },
  ],
};

/** Generic starter menu for any new tablet vendor without a template, so the demo never shows an empty stall. */
export const STARTER_TABLET_MENU: TabletMenuItem[] = [
  { posItemId: "tb_001", name: "House special", description: "Ask the stall for today's special.", category: "Mains", priceMinor: 2500 },
  { posItemId: "tb_002", name: "Side of the day", description: "Rotating side.", category: "Sides", priceMinor: 1200 },
  { posItemId: "tb_003", name: "Bottled water", description: "Still, 500ml.", category: "Drinks", priceMinor: 300 },
];
