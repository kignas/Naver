import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/icons';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import '../styles/pages/profile.css';

interface MenuRow {
  icon: IconName;
  tile: string;
  label: string;
}

const MENU_ROWS: MenuRow[] = [
  { icon: 'solid:ticket', tile: 'orange', label: 'My Vouchers' },
  { icon: 'regular:file-lines', tile: 'blue', label: 'Account Statements' },
  { icon: 'regular:heart', tile: 'red', label: 'Favourites' },
  { icon: 'solid:crown', tile: 'yellow', label: 'Partner Rewards' },
  { icon: 'solid:graduation-cap', tile: 'green', label: 'Student Rewards' },
  { icon: 'solid:comment-dots', tile: 'gray', label: 'Contact Preferences' },
];

const QUICK_ACTIONS: { icon: IconName; tile: string; label: string }[] = [
  { icon: 'solid:location-dot', tile: 'orange', label: 'Saved Address' },
  { icon: 'solid:wallet', tile: 'blue', label: 'Payment Modes' },
  { icon: 'solid:money-bill-transfer', tile: 'green', label: 'My Refunds' },
  { icon: 'solid:credit-card', tile: 'purple', label: 'Navereat Wallet' },
];

const formatPhone = (phone: string | undefined): string => {
  if (!phone) return '+91 98765 43210';
  const digits = phone.replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
};

export function Profile() {
  const nav = useAppNav();
  const user = useAppStore((s) => s.user);
  const orders = useAppStore((s) => s.orders);
  const logout = useAppStore((s) => s.logout);
  const recent = orders.slice(0, 2);

  const demo = (label: string) => toast(`${label} is not part of this demo`);

  return (
    <div className="page profile-page">
      <div className="page-scroll profile-scroll">
        <header className="profile-hero">
          <span className="profile-circle-a" />
          <span className="profile-circle-b" />
          <div className="profile-hero-inner">
            <div className="profile-top">
              <button type="button" className="profile-back tap" onClick={() => nav.tab('/')} aria-label="Back">
                <Icon name="solid:arrow-left" size={14} />
              </button>
              <div className="profile-top-right">
                <button type="button" className="profile-help tap" onClick={() => demo('Help centre')}>
                  Help
                </button>
                <button type="button" className="profile-more tap" aria-label="More" onClick={() => demo('More options')}>
                  <Icon name="solid:ellipsis-vertical" size={14} />
                </button>
              </div>
            </div>

            <div className="profile-user">
              <div className="profile-avatar">
                <Icon name="solid:user" size={24} />
              </div>
              <div>
                <h1 className="profile-name">{user?.name ?? 'Demo Foodie'}</h1>
                <p className="profile-phone">{formatPhone(user?.phone)}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="profile-content">
          <button
            type="button"
            className="membership-card tap-soft"
            onClick={() => demo('Navereat ONE membership')}
          >
            <div>
              <div className="membership-brand">
                <span className="membership-name">navereat</span>
                <span className="membership-one">one</span>
                <span className="membership-join">Join Now</span>
              </div>
              <p className="membership-title">Unlimited free deliveries &amp; extra discounts</p>
              <p className="membership-sub">Unlock exclusive Navereat benefits</p>
            </div>
            <Icon name="solid:chevron-right" size={14} />
          </button>

          <div className="quick-grid">
            {QUICK_ACTIONS.map((action) => (
              <button
                type="button"
                className="quick-item tap"
                key={action.label}
                onClick={() => demo(action.label)}
              >
                <span className={`quick-icon ${action.tile}`}>
                  <Icon name={action.icon} size={16} />
                </span>
                <span className="quick-label">{action.label}</span>
              </button>
            ))}
          </div>

          <div className="profile-menu">
            {MENU_ROWS.map((row) => (
              <button
                type="button"
                className="profile-menu-row"
                key={row.label}
                onClick={() => demo(row.label)}
              >
                <span className="profile-menu-left">
                  <span className={`profile-menu-icon ${row.tile}`}>
                    <Icon name={row.icon} size={14} />
                  </span>
                  <span className="profile-menu-label">{row.label}</span>
                </span>
                <Icon name="solid:chevron-right" size={12} className="chev" />
              </button>
            ))}
            <button
              type="button"
              className="profile-menu-row"
              onClick={() => {
                logout();
                nav.reset('/login');
                toast('Logged out of the demo');
              }}
            >
              <span className="profile-menu-left">
                <span className="profile-menu-icon red">
                  <Icon name="solid:arrow-right" size={14} />
                </span>
                <span className="profile-menu-label profile-logout-label">Log out</span>
              </span>
              <Icon name="solid:chevron-right" size={12} className="chev" />
            </button>
          </div>

          <div className="profile-past">
            <h3 className="profile-past-title">Past Orders</h3>
            {recent.length === 0 ? (
              <div className="profile-past-empty">
                <div className="profile-past-icon">
                  <Icon name="solid:bag-shopping" size={32} />
                </div>
                <h4>No orders yet</h4>
                <p>
                  Order food from restaurants near you
                  <br />
                  and track all your orders here
                </p>
                <button type="button" className="profile-past-btn" onClick={() => nav.tab('/')}>
                  Explore Navereat
                </button>
              </div>
            ) : (
              recent.map((order) => (
                <button
                  type="button"
                  className="profile-order-row"
                  key={order.id}
                  onClick={() => nav.push(`/track/${order.id}`)}
                >
                  <span>
                    <span className="profile-order-name">{order.restaurantName}</span>
                    <span className="profile-order-sub" style={{ display: 'block' }}>
                      {order.id} · {order.status.replace(/_/g, ' ')}
                    </span>
                  </span>
                  <span className="profile-order-total">{formatMoney(order.total)}</span>
                </button>
              ))
            )}
          </div>

          <div className="profile-footer">
            <p>Navereat v1.0.0 · Made with ❤ in Maynaguri</p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
