export function VegDot({ isVeg }: { isVeg: boolean }) {
  return (
    <span className={`veg-dot ${isVeg ? 'veg' : 'nonveg'}`} aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}>
      <span className="dot" />
    </span>
  );
}
