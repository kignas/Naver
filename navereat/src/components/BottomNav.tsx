import { useLocation } from 'react-router-dom';
import { useAppNav } from '../lib/navigation';
import { useSearchStore } from '../store/searchStore';
import { Icon } from './Icon';
import type { IconName } from './icons';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
}

const ITEMS: NavEntry[] = [
  { to: '/', label: 'Home', icon: 'solid:house' },
  { to: '/under99', label: '₹99 Store', icon: 'solid:tag' },
  { to: '/search', label: 'Search', icon: 'solid:magnifying-glass' },
  { to: '/orders', label: 'Orders', icon: 'solid:list' },
  { to: '/profile', label: 'Profile', icon: 'solid:user' },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const nav = useAppNav();
  const openSearch = useSearchStore((state) => state.openSearch);
  const searchOpen = useSearchStore((state) => state.isOpen);
  const searchContext = pathname === '/under99' ? 'under99' : 'home';

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map((item) => {
        const isSearch = item.to === '/search';
        const active = isSearch
          ? searchOpen
          : searchOpen
            ? false
            : item.to === '/'
              ? pathname === '/'
              : pathname.startsWith(item.to);
        return (
          <button
            key={item.to}
            type="button"
            className={`nav-item tap${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (isSearch) {
                openSearch(searchContext);
                return;
              }
              if (!active) nav.tab(item.to);
            }}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
