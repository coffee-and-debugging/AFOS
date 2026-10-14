import { assetUrl } from '../api/client';
import Icon, { type IconName } from './Icon';

const CATEGORY_ICONS: [RegExp, IconName][] = [
  [/burger|sandwich/i, 'burger'],
  [/pizza/i, 'pizza'],
  [/momo|dumpling/i, 'dumpling'],
  [/side|fries|snack|starter/i, 'fries'],
  [/drink|beverage|tea|coffee|juice|bar/i, 'cup'],
  [/dessert|cake|sweet|bakery/i, 'cake'],
  [/main|rice|curry|noodle|set|thali/i, 'bowl'],
];

function iconFor(category: string): IconName {
  return CATEGORY_ICONS.find(([re]) => re.test(category))?.[1] ?? 'flame';
}

/** The item's photo, or a poster-style placeholder with a category icon. */
export default function FoodVisual({ imageUrl, category, iconSize = 40 }: { imageUrl?: string | null; category: string; iconSize?: number }) {
  return (
    <div className="food-visual">
      {imageUrl
        ? <img src={assetUrl(imageUrl)} alt="" loading="lazy" />
        : <span className="food-visual-icon"><Icon name={iconFor(category)} size={iconSize} /></span>}
    </div>
  );
}
