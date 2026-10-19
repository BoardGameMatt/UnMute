export const FAMILIES = ["round", "peaked", "long", "boxy", "distinct"] as const;
export type Family = (typeof FAMILIES)[number];

export type Picture = {
  id: string;
  label: string;
  family: Family;
  starter: boolean;
};

function row(family: Family, items: ReadonlyArray<readonly [string, string, 1?]>): Picture[] {
  return items.map(([id, label, starter]) => ({
    id,
    label,
    family,
    starter: starter === 1,
  }));
}

/** Pack A. Ids match `otsp_pictures.slug`. Sample explainer words are not in this list. */
export const PACK_A: Picture[] = [
  ...row("round", [
    ["alarm-clock", "Alarm clock"],
    ["apple", "Apple", 1],
    ["cat", "Cat"],
    ["ghost", "Ghost"],
    ["guitar", "Guitar", 1],
    ["hot-air-balloon", "Hot air balloon"],
    ["ladybug", "Ladybug", 1],
    ["light-bulb", "Light bulb"],
    ["rabbit", "Rabbit"],
    ["tree", "Tree"],
  ]),
  ...row("peaked", [
    ["bell", "Bell"],
    ["house", "House"],
    ["kite", "Kite"],
    ["lighthouse", "Lighthouse"],
    ["mushroom", "Mushroom"],
    ["pine-tree", "Pine tree"],
    ["rocket", "Rocket", 1],
    ["sailboat", "Sailboat", 1],
    ["table-lamp", "Table lamp"],
    ["umbrella", "Umbrella"],
  ]),
  ...row("long", [
    ["boot", "Boot"],
    ["bus", "Bus"],
    ["car", "Car", 1],
    ["fish", "Fish", 1],
    ["key", "Key", 1],
    ["snail", "Snail"],
    ["submarine", "Submarine", 1],
    ["tractor", "Tractor"],
    ["train", "Train"],
    ["turtle", "Turtle"],
  ]),
  ...row("boxy", [
    ["bed", "Bed"],
    ["castle", "Castle"],
    ["chair", "Chair", 1],
    ["gift", "Gift"],
    ["laptop", "Laptop"],
    ["mug", "Mug", 1],
    ["teapot", "Teapot", 1],
    ["television", "Television"],
    ["toaster", "Toaster"],
    ["top-hat", "Top hat", 1],
  ]),
  ...row("distinct", [
    ["airplane", "Airplane"],
    ["cactus", "Cactus"],
    ["candle", "Candle", 1],
    ["crown", "Crown"],
    ["flower", "Flower", 1],
    ["heart", "Heart"],
    ["hourglass", "Hourglass", 1],
    ["ladder", "Ladder"],
    ["robot", "Robot"],
    ["trophy", "Trophy"],
  ]),
];

export function pictureById(catalog: readonly Picture[], id: string): Picture | undefined {
  return catalog.find((picture) => picture.id === id);
}
