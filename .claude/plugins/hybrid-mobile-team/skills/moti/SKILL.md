---
name: moti
description: |
  Universal animation skill using Moti (built on Reanimated). Use this for declarative, prop-driven animations — mount/unmount transitions with AnimatePresence, skeleton loading placeholders, state-machine animations with useAnimationState, and simple animate-on-mount patterns where Reanimated's imperative API would be overkill.
version: "1.0.0"
---

# Moti — Universal Animation Skill

You are an expert in Moti, a universal animation library for React Native powered by Reanimated. Use the reference documentation in `references/` for exact API signatures and patterns.

## When to Use This Skill

- Simple animate-on-mount effects (fade in, slide up)
- Mount/unmount transitions with `AnimatePresence`
- Skeleton loading placeholders
- State-machine driven animations (`useAnimationState`)
- Declarative prop-based animations where imperative Reanimated would be overkill
- Staggered list item animations with `MotiView` + delay
- Hover/press visual feedback patterns

## When to Use Reanimated Instead

- Gesture-driven animations (pan, pinch, fling)
- Scroll-linked animations
- Complex keyframe choreography
- Performance-critical animations requiring direct worklet control
- `interpolate()` / `interpolateColor()` mapping
- Physics-based decay animations

## Core Principles

1. **Declarative Over Imperative** — Pass `from`, `animate`, and `exit` props. No shared values or worklets needed.
2. **AnimatePresence for Mount/Unmount** — Wrap conditional renders in `<AnimatePresence>` so exit animations play before removal.
3. **Transition Config on the Component** — Define spring/timing config via the `transition` prop, not inside animation values.
4. **useAnimationState for Multi-State** — When a component switches between 2+ visual states, use `useAnimationState` instead of ternaries.
5. **Skeleton for Loading** — Use `<Skeleton>` with `colorMode` for shimmer placeholders instead of custom loading spinners.

## Quick Reference

### Animate on Mount
```tsx
import { MotiView } from 'moti';

<MotiView
  from={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ type: 'timing', duration: 350 }}
/>
```

### Mount/Unmount with AnimatePresence
```tsx
import { AnimatePresence, MotiView } from 'moti';

<AnimatePresence>
  {visible && (
    <MotiView
      key="toast"
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -20 }}
    />
  )}
</AnimatePresence>
```

### Skeleton Loading
```tsx
import { Skeleton } from 'moti/skeleton';

<Skeleton colorMode="light" width={200} height={20} />
<Skeleton colorMode="light" radius="round" width={48} height={48} />
```

### State Machine
```tsx
import { useAnimationState, MotiView } from 'moti';

const state = useAnimationState({
  inactive: { opacity: 0.5, scale: 0.95 },
  active: { opacity: 1, scale: 1 },
});

// Trigger: state.transitionTo('active')
<MotiView state={state} />
```

## Common Mistakes to Avoid

- **Don't forget `AnimatePresence`** — Without it, `exit` props are ignored and components vanish instantly
- **Don't mix `animate` prop with `state` prop** — Use one or the other, never both
- **Don't set `transition` inside `from`/`animate` objects** — It's a separate prop on the component
- **Don't use Moti for gesture animations** — Use Reanimated + Gesture Handler directly
- **Always add a unique `key` to AnimatePresence children** — React needs it to track mount/unmount correctly
