import { useLayoutEffect } from 'react';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { useAppNav } from '../lib/navigation';
import { useSearchStore } from '../store/searchStore';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import profileBundleCss from '../styles/original/profile.bundle.css?raw';
import profileShellCss from '../styles/original/profile-shell.css?raw';
import '../styles/pages/profile.css';

type SpriteName =
  | 'back'
  | 'search'
  | 'chevron'
  | 'check'
  | 'orders'
  | 'address'
  | 'heart'
  | 'info'
  | 'help'
  | 'doc'
  | 'shield'
  | 'refund'
  | 'star'
  | 'logout'
  | 'offline';

function SpriteIcon({ name, className = 'pf-ico' }: { name: SpriteName; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#ew-${name}`} />
    </svg>
  );
}

function Row({
  icon,
  title,
  sub,
  value,
  onClick,
  logout,
}: {
  icon: SpriteName;
  title: string;
  sub?: string;
  value?: string;
  onClick: () => void;
  logout?: boolean;
}) {
  return (
    <button type="button" className={`row${logout ? ' logout' : ' is-nav'}`} onClick={onClick}>
      <span className="row-icon">
        <SpriteIcon name={icon} />
      </span>
      <span className="row-main">
        <span className="row-title" style={{ display: 'block' }}>
          {title}
        </span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {value && <span className="row-value">{value}</span>}
      {!logout && <SpriteIcon name="chevron" className="pf-ico chev" />}
    </button>
  );
}

const profileStyle = createRouteStyleSheet(`${profileShellCss}\n${profileBundleCss}`, 'navereatProfile', '/profile');

export function Profile() {
  const nav = useAppNav();
  const openSearch = useSearchStore((state) => state.openSearch);
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  useLayoutEffect(() => profileStyle.attach(), []);

  const name = user?.name?.trim() || 'Navereat User';
  const phone = user?.phone?.trim() || '+91 98765 43210';
  const email = user?.email?.trim() || '';
  const initial = name.charAt(0).toUpperCase() || 'N';

  return (
    <div className="page profile-page">
      <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
        <defs>
          <symbol id="ew-back" viewBox="0 0 24 24"><path d="M20 12H4.5M10.5 18l-6-6 6-6" /></symbol>
          <symbol id="ew-search" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m20 20-4.4-4.4" /></symbol>
          <symbol id="ew-chevron" viewBox="0 0 24 24"><path d="m9.5 6 6 6-6 6" /></symbol>
          <symbol id="ew-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8.2 12.3 2.6 2.6 5-5.3" /></symbol>
          <symbol id="ew-orders" viewBox="0 0 24 24"><path d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-1.2-.8-1.2.8-2.4-1.5L6 20.5z" /><path d="M9.2 8.5h5.6M9.2 12h5.6M9.2 15.5h3.4" /></symbol>
          <symbol id="ew-address" viewBox="0 0 24 24"><path d="M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.4" /></symbol>
          <symbol id="ew-heart" viewBox="0 0 24 24"><path d="M12 19.6s-7.5-4.6-7.5-10.1A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 7.5 2.4c0 5.5-7.5 10.1-7.5 10.1z" /></symbol>
          <symbol id="ew-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.2M12 7.9v.1" /></symbol>
          <symbol id="ew-help" viewBox="0 0 24 24"><path d="M4.5 14.5V12a7.5 7.5 0 0 1 15 0v2.5" /><path d="M4.5 13.5h2.2v5H5.6a1.1 1.1 0 0 1-1.1-1.1zM19.5 13.5h-2.2v5h1.1a1.1 1.1 0 0 0 1.1-1.1z" /><path d="M17.3 18.5c0 1.2-1.6 2-3.8 2" /></symbol>
          <symbol id="ew-doc" viewBox="0 0 24 24"><path d="M6.5 3.5h7.8l4.2 4.2v12.8h-12z" /><path d="M14 3.5v4.5h4.5M9.3 12.5h5.4M9.3 16h5.4" /></symbol>
          <symbol id="ew-shield" viewBox="0 0 24 24"><path d="M12 3.3 18.8 6v5.4c0 4.4-2.9 7.6-6.8 9.3-3.9-1.7-6.8-4.9-6.8-9.3V6z" /><path d="m9 12 2.1 2.1 4-4.2" /></symbol>
          <symbol id="ew-refund" viewBox="0 0 24 24"><path d="M4.8 9.5A7.6 7.6 0 0 1 18.7 8M19.2 14.5A7.6 7.6 0 0 1 5.3 16" /><path d="M19 4.5V8h-3.5M5 19.5V16h3.5" /></symbol>
          <symbol id="ew-star" viewBox="0 0 24 24"><path d="m12 3.9 2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.8l-5 2.6 1-5.6-4.1-4 5.6-.8z" /></symbol>
          <symbol id="ew-logout" viewBox="0 0 24 24"><path d="M9.5 4H6.3A1.8 1.8 0 0 0 4.5 5.8v12.4A1.8 1.8 0 0 0 6.3 20h3.2M15 8l4 4-4 4M9 12h10" /></symbol>
        </defs>
      </svg>

      <div className="app">
        <header className="header">
          <div className="top">
            <button className="icon-btn back" type="button" aria-label="Back" onClick={() => nav.tab('/')}>
              <SpriteIcon name="back" />
            </button>
            <div className="title pf-sr">Profile</div>
            <div className="top-actions">
              <button className="icon-btn search" type="button" aria-label="Search" onClick={() => openSearch('home')}>
                <SpriteIcon name="search" />
              </button>
            </div>
          </div>
          <div className="profile-hero">
            <div className="avatar" id="avatar">
              {initial}
            </div>
            <div className="user">
              <h1 id="userName">{name}</h1>
              <div className="contact">
                <span id="userPhone">{phone}</span>
                <span className="verified" id="verifiedBadge">
                  <SpriteIcon name="check" />
                  <span>Verified</span>
                </span>
              </div>
              {email && (
                <div className="contact" id="userEmailLine">
                  <span id="userEmail">{email}</span>
                </div>
              )}
              <button className="edit-profile" id="editProfileBtn" type="button" onClick={() => toast('Edit profile is part of the demo')}>
                Edit profile
                <SpriteIcon name="chevron" />
              </button>
            </div>
          </div>
        </header>

        <div className="quick">
          <button className="quick-tile" type="button" onClick={() => nav.tab('/orders')}>
            <span className="quick-ico">
              <SpriteIcon name="orders" />
            </span>
            <span>Orders</span>
          </button>
          <button className="quick-tile" type="button" onClick={() => toast('Address book is not part of this demo')}>
            <span className="quick-ico">
              <SpriteIcon name="address" />
            </span>
            <span>Addresses</span>
          </button>
        </div>

        <main className="content">
          <section className="section">
            <h2 className="section-title">Favourites</h2>
            <details className="pf-card fav-toggle">
              <summary className="row fav-summary">
                <span className="row-icon">
                  <SpriteIcon name="heart" />
                </span>
                <span className="row-main">
                  <span className="row-title" style={{ display: 'block' }}>
                    Saved restaurants
                  </span>
                </span>
                <span className="row-value" />
                <SpriteIcon name="chevron" className="pf-ico chev" />
              </summary>
              <div className="fav-body">
                <div className="fav-note">No saved restaurants yet.</div>
              </div>
            </details>
          </section>

          <section className="section">
            <h2 className="section-title">Orders &amp; delivery</h2>
            <div className="pf-card">
              <Row icon="orders" title="Your orders" onClick={() => nav.tab('/orders')} />
              <Row icon="address" title="Saved addresses" value="Home" onClick={() => toast('Saved addresses are not part of this demo')} />
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Help &amp; support</h2>
            <div className="pf-card">
              <Row icon="help" title="Contact support" onClick={() => toast('Support is not part of this demo')} />
              <Row icon="info" title="About Navereat" onClick={() => toast('Navereat · demo build v1.0.0')} />
              <Row icon="help" title="Frequently asked questions" onClick={() => toast('FAQ is not part of this demo')} />
              <Row icon="help" title="Order help &amp; issue reporting" onClick={() => toast('Order help is not part of this demo')} />
              <Row icon="address" title="Delivery areas &amp; charges" onClick={() => toast('Delivery areas are not part of this demo')} />
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">For restaurant partners</h2>
            <div className="pf-card">
              <Row icon="info" title="Partner with Navereat" onClick={() => toast('Partner onboarding is not part of this demo')} />
              <Row icon="info" title="Partner rules &amp; regulations" sub="Eligibility, requirements and onboarding" onClick={() => toast('Partner rules are not part of this demo')} />
              <Row icon="doc" title="My restaurant application" sub="Check your application status" onClick={() => toast('Application status is not part of this demo')} />
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Legal &amp; policies</h2>
            <div className="pf-card">
              <Row icon="doc" title="Terms &amp; conditions" onClick={() => toast('Terms are not part of this demo')} />
              <Row icon="shield" title="Privacy policy" onClick={() => toast('Privacy policy is not part of this demo')} />
              <Row icon="shield" title="Privacy &amp; data" sub="Your data, requests &amp; account controls" onClick={() => toast('Privacy controls are not part of this demo')} />
              <Row icon="refund" title="Cancellation &amp; refund" onClick={() => toast('Refund policy is not part of this demo')} />
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">More</h2>
            <div className="pf-card">
              <button className="row" type="button" role="switch" aria-checked="false" aria-label="Toggle dark mode" onClick={() => toast('Dark mode is not part of this demo')}>
                <span className="row-icon" aria-hidden="true">
                  <svg className="pf-ico" viewBox="0 0 24 24">
                    <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" />
                  </svg>
                </span>
                <span className="row-main">
                  <span className="row-title" style={{ display: 'block' }}>
                    Dark mode
                  </span>
                </span>
                <span className="ew-theme-switch" aria-hidden="true" />
              </button>
              <Row icon="star" title="Rate your experience" onClick={() => toast('Ratings are part of the demo')} />
              <button
                className="row logout"
                type="button"
                onClick={() => {
                  logout();
                  toast('Logged out of the demo');
                  nav.reset('/login');
                }}
              >
                <span className="row-icon">
                  <SpriteIcon name="logout" />
                </span>
                <span className="row-main">
                  <span className="row-title" style={{ display: 'block' }}>
                    Log out
                  </span>
                </span>
              </button>
            </div>
          </section>
        </main>
      </div>

    </div>
  );
}
