import type { MenuGroup } from './menuTypes';

/**
 * The menu placeholder: one row per real dish so the skeleton owns the same
 * height the menu will, and the reveal can swap content without a jump.
 */
export function MenuSkeleton({ groups }: { groups: MenuGroup[] }) {
  const rows = groups.length ? groups : [{ name: 'Recommended', items: [] } as MenuGroup];
  return (
    <div className="rv-menu-skeleton" aria-hidden="true">
      <div className="rv-menu-chips">
        {rows.map((group, index) => (
          <span
            className="rv-sk rv-chip"
            key={`${group.name}-${index}`}
            style={{ width: index % 3 === 0 ? 76 : 62 }}
          />
        ))}
      </div>
      <div className="menu-section rv-menu-section">
        {rows.map((group, groupIndex) => (
          <div className="menu-cat-group" key={`${group.name}-${groupIndex}`}>
            <div className="menu-cat-header">
              <span className="rv-sk rv-cat-title" style={{ width: groupIndex % 2 === 0 ? 150 : 118 }} />
            </div>
            <div className="menu-cat-items">
              {(group.items.length ? group.items : [null, null]).map((item, index) => (
                <div className="skel-item" key={item?.id ?? index}>
                  <div className="skel-left">
                    <span className="rv-sk" style={{ height: 14, width: 56, borderRadius: 6 }} />
                    <span className="rv-sk" style={{ height: 16, width: index % 2 === 0 ? '62%' : '48%' }} />
                    <span className="rv-sk" style={{ height: 15, width: 52 }} />
                    <span className="rv-sk" style={{ height: 12, width: index % 2 === 0 ? '92%' : '78%' }} />
                  </div>
                  <div className="skel-media">
                    <span className="rv-sk skel-img" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
