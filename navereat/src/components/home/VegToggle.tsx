import { memo } from 'react';
import { motion } from 'framer-motion';
import { useUiStore } from '../../store/uiStore';
import { tapHaptic } from '../../lib/haptics';

/**
 * Subscribes to `vegOnly` alone: the tap re-renders this button, the filter
 * pills and the feed, not the header, hero or category strip. The knob is a
 * `layout` element, so the spring travels between the two track ends instead
 * of reading a CSS transition.
 */
export const VegToggle = memo(function VegToggle() {
  const vegOnly = useUiStore((state) => state.home.vegOnly);
  const toggleHomeFlag = useUiStore((state) => state.toggleHomeFlag);
  const toggle = () => {
    tapHaptic();
    toggleHomeFlag('vegOnly');
  };
  return (
    <motion.button
      type="button"
      className={`veg-box${vegOnly ? ' is-veg' : ''}`}
      id="veg-toggle-btn"
      aria-pressed={vegOnly}
      aria-label="Show pure veg restaurants only"
      onClick={toggle}
      whileTap={{ scale: 0.94 }}
    >
      <span className="veg-label-txt">VEG</span>
      <span className={`veg-track${vegOnly ? ' on' : ''}`} id="veg-track">
        <motion.span
          layout
          className="veg-thumb"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ willChange: 'transform' }}
        >
          <span className="veg-inner">
            <span className="veg-inner-dot" />
          </span>
        </motion.span>
      </span>
    </motion.button>
  );
});
