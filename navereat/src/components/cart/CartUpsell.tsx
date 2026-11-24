import { useCallback } from 'react';
import { CompleteYourMeal } from '../CompleteYourMeal';
import { useCustomize } from '../../lib/customizeContext';
import { useAppNav } from '../../lib/navigation';
import { useAppStore } from '../../store/appStore';
import { toast } from '../../store/toastStore';
import { useCartTotals } from './cartTotals';

export function CartUpsell() {
  const nav = useAppNav();
  const addItem = useAppStore((state) => state.addItem);
  const { openCustomize } = useCustomize();
  const { cart, restaurant } = useCartTotals();

  const seeAll = useCallback(() => nav.push(`/restaurant/${restaurant?.id ?? 2}`), [nav, restaurant?.id]);
  const add = useCallback(
    (item: Parameters<typeof addItem>[0]) => {
      if (!restaurant) return;
      addItem(item, restaurant.id);
      toast(`${item.name} added to your order`, 'success');
    },
    [addItem, restaurant],
  );
  const customize = useCallback(
    (item: Parameters<typeof addItem>[0]) => {
      if (!restaurant) return;
      openCustomize(item, restaurant.id);
    },
    [openCustomize, restaurant],
  );

  return (
    <CompleteYourMeal
      restaurant={restaurant ?? null}
      cart={cart}
      onSeeAll={seeAll}
      onAdd={add}
      onCustomize={customize}
    />
  );
}
