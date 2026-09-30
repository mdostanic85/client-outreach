/**
 * Shared classes for floating surfaces (menus, select, tooltip). White,
 * overlay shadow, no border. Open: y 10 → 0, scale .98 → 1, opacity over
 * 250ms `ease-enter`. Close: 150ms `ease-exit`. Driven by Base UI's
 * `data-starting-style` / `data-ending-style`.
 */
export const popupSurface =
  "bg-popover text-popover-foreground shadow-overlay outline-none"

export const popupMotion =
  "origin-(--transform-origin) transition-[opacity,transform,scale,translate] duration-250 ease-enter data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-[side=bottom]:data-starting-style:translate-y-2.5 data-[side=top]:data-starting-style:-translate-y-2.5 data-[side=left]:data-starting-style:translate-x-2.5 data-[side=right]:data-starting-style:-translate-x-2.5 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-exit motion-reduce:transition-opacity motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100"

/** Menu rows / select options: 12px radius, subtle highlight on focus. */
export const popupItem =
  "relative flex cursor-default items-center gap-2 rounded-tile px-3 py-2 text-body-sm outline-hidden select-none transition-colors duration-150 ease-standard data-highlighted:bg-subtle focus:bg-subtle data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground"
