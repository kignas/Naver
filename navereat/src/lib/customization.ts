import type { CustomizationGroup, CustomizationOption, MenuItem } from '../data/demo';
import type { Cart, CartCustomization } from './cart';

export interface CustomizationSelection {
  groupIndex: number;
  optionIndex: number;
  group: CustomizationGroup;
  option: CustomizationOption;
  pricingMode: 'extra' | 'portion';
}

export const selectionKey = (groupIndex: number, optionIndex: number): string => `${groupIndex}:${optionIndex}`;

export const groupsFor = (item: MenuItem): CustomizationGroup[] =>
  Array.isArray(item.customizations)
    ? item.customizations
    : Array.isArray(item.customizationGroups)
      ? item.customizationGroups
      : [];

export const hasCustomization = (item: MenuItem): boolean =>
  groupsFor(item).some((group) => Array.isArray(group.options) && group.options.length > 0);

export const isCustomisable = (item: MenuItem): boolean =>
  item.isCustomisable === true || item.customisable === true || hasCustomization(item);

export const defaultSelectionKeys = (item: MenuItem): Set<string> => {
  const keys = new Set<string>();
  groupsFor(item).forEach((group, groupIndex) => {
    const max = Math.max(1, Number(group.maxSelect) || 1);
    if (group.required && max === 1 && group.options[0]) keys.add(selectionKey(groupIndex, 0));
  });
  return keys;
};

export const selectionsFor = (item: MenuItem, keys: Set<string>): CustomizationSelection[] => {
  const selected: CustomizationSelection[] = [];
  groupsFor(item).forEach((group, groupIndex) => {
    const max = Math.max(1, Number(group.maxSelect) || 1);
    group.options.forEach((option, optionIndex) => {
      if (!keys.has(selectionKey(groupIndex, optionIndex))) return;
      selected.push({
        groupIndex,
        optionIndex,
        group,
        option,
        pricingMode: group.pricingMode === 'portion' ? 'portion' : 'extra',
      });
    });
    if (max === 1) {
      const groupSelections = selected.filter((entry) => entry.groupIndex === groupIndex);
      if (groupSelections.length > 1) selected.splice(selected.indexOf(groupSelections[0]), groupSelections.length - 1);
    }
  });
  return selected;
};

export const isSelectionValid = (item: MenuItem, selections: CustomizationSelection[]): boolean =>
  groupsFor(item).every((group, groupIndex) => {
    const checked = selections.filter((entry) => entry.groupIndex === groupIndex);
    const max = Math.max(1, Number(group.maxSelect) || 1);
    if (checked.length > max) return false;
    if (group.pricingMode === 'portion' && checked.length > 1) return false;
    return !group.required || checked.length >= 1;
  });

export const unitPriceFor = (item: MenuItem, selections: CustomizationSelection[]): number => {
  let extra = 0;
  let portion: number | null = null;
  selections.forEach((selection) => {
    const price = Number(selection.option.extraPrice) || 0;
    if (selection.pricingMode === 'portion') portion = price;
    else extra += price;
  });
  return (portion ?? (Number(item.price) || 0)) + extra;
};

export const labelsFor = (selections: CustomizationSelection[]): string[] =>
  selections.map((selection) => selection.option.label);

export const compositeNameFor = (item: MenuItem, selections: CustomizationSelection[]): string => {
  const labels = labelsFor(selections);
  return labels.length ? `${item.name} (${labels.join(', ')})` : item.name;
};

export const flatCustomizationsFor = (selections: CustomizationSelection[]): CartCustomization[] =>
  selections.map((selection) => ({
    title: selection.group.title,
    label: selection.option.label,
    extraPrice: Number(selection.option.extraPrice) || 0,
    pricingMode: selection.pricingMode,
    isVeg: selection.option.isVeg !== false,
  }));

export const selectionKeysFromLine = (item: MenuItem, line: { customizations?: CartCustomization[] }): Set<string> => {
  const labels = new Set((line.customizations ?? []).map((entry) => entry.label));
  const keys = new Set<string>();
  groupsFor(item).forEach((group, groupIndex) => {
    group.options.forEach((option, optionIndex) => {
      if (labels.has(option.label)) keys.add(selectionKey(groupIndex, optionIndex));
    });
  });
  return keys;
};

export const customizedQtyFor = (cart: Cart, item: MenuItem): number => {
  let total = 0;
  Object.entries(cart).forEach(([key, line]) => {
    if (!line || Number(line.quantity) <= 0) return;
    const entryId = String(line.menuItem ?? '');
    const sameId = Boolean(item.id && entryId === item.id);
    const composite = key === item.name || key.startsWith(`${item.name} (`);
    if (sameId || composite) total += Number(line.quantity);
  });
  return total;
};

export const editKeyFor = (cart: Cart, item: MenuItem): string | null => {
  for (const [key, line] of Object.entries(cart)) {
    if (!line || Number(line.quantity) <= 0) continue;
    if (String(line.menuItem ?? '') !== item.id) continue;
    if (Array.isArray(line.customizations)) return key;
  }
  return null;
};

export const customTextFor = (value: CartCustomization[] | string | undefined): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return value
    .map((entry) => (typeof entry === 'string' ? entry : entry.label || entry.title || ''))
    .filter(Boolean)
    .join(', ');
};

export const displayNameFor = (name: string, customText: string): string => {
  if (!customText) return name;
  const tail = /\s*\(([^()]*)\)\s*$/.exec(name);
  if (!tail) return name;
  const allShown = tail[1].split(',').every((part) => customText.toLowerCase().includes(part.trim().toLowerCase()));
  return allShown ? name.slice(0, tail.index) || name : name;
};
