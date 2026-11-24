import { memo } from 'react';
import { demoUser } from '../../data/demo';
import { useAppStore } from '../../store/appStore';

/**
 * Owns the `user` subscription so a login/logout cannot re-render the header.
 */
export const ProfileButton = memo(function ProfileButton({ onOpen }: { onOpen: () => void }) {
  const user = useAppStore((state) => state.user);
  const initial = (user?.name ?? demoUser.name).charAt(0).toUpperCase();
  return (
    <button type="button" className="btn-profile tap" aria-label="Profile" onClick={onOpen}>
      <span className="profile-initial">{initial}</span>
    </button>
  );
});
