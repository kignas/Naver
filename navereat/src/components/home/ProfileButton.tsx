import { memo } from 'react';
import { motion } from 'framer-motion';
import { demoUser } from '../../data/demo';
import { useAppStore } from '../../store/appStore';

/**
 * Owns the `user` subscription so a login/logout cannot re-render the header.
 * The spring entrance and tap scale are the tactile half of the top bar.
 */
export const ProfileButton = memo(function ProfileButton({ onOpen }: { onOpen: () => void }) {
  const user = useAppStore((state) => state.user);
  const initial = (user?.name ?? demoUser.name).charAt(0).toUpperCase();
  return (
    <motion.button
      type="button"
      className="btn-profile"
      aria-label="Profile"
      onClick={onOpen}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 480, damping: 15, delay: 0.08 }}
      whileTap={{ scale: 0.92 }}
    >
      <span className="profile-initial">{initial}</span>
    </motion.button>
  );
});
