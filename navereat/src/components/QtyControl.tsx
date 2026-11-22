interface QtyControlProps {
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  minWidth?: number;
}

export function QtyControl({ qty, onAdd, onRemove, minWidth }: QtyControlProps) {
  return (
    <div className="add-btn-wrap" style={minWidth ? { minWidth } : undefined}>
      <button type="button" onClick={onRemove} aria-label="Remove one">
        −
      </button>
      <span>{qty}</span>
      <button type="button" onClick={onAdd} aria-label="Add one">
        +
      </button>
    </div>
  );
}
