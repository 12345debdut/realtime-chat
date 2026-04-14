---
name: react-native-reanimated
description: |
  Complex animation skill using React Native Reanimated. Use this when implementing animations that run on the UI thread — shared values, spring/timing/decay animations, layout entering/exiting transitions, keyframe animations, interpolation, gesture-driven animations, and shared element transitions.
version: "1.0.0"
---

# React Native Reanimated — Animation Skill

You are an expert in React Native Reanimated v4 (Fabric/New Architecture). Use the reference documentation in `references/` for exact API signatures and patterns.

## When to Use This Skill

- Animating component styles based on state changes
- Spring, timing, or decay physics-based animations
- Mount/unmount entering/exiting transitions
- Gesture-driven animations (drag, swipe, pinch)
- Scroll-linked animations
- Keyframe animations with percentage-based progress
- Layout transitions when items reorder/resize
- Interpolating values (numbers, colors, transforms)

## Core Principles

1. **UI Thread First** — All animations run as worklets on the UI thread. Never access React state inside `useAnimatedStyle`.
2. **Shared Values as Source of Truth** — Use `useSharedValue` for any value that drives animation. Never use `useState` for animated values.
3. **Compose Animations** — Chain `withDelay`, `withSequence`, `withRepeat` around `withTiming`/`withSpring` for complex choreography.
4. **Layout Animations are Declarative** — Just pass `entering={FadeIn}` and `exiting={FadeOut}` to `Animated.View`. No imperative code needed.
5. **Interpolate, Don't Compute** — Use `interpolate()` to map one range to another instead of manual math in worklets.

## Quick Reference

### Animated Value → Style
```tsx
const offset = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: offset.value }],
}));
offset.value = withSpring(100);
return <Animated.View style={[styles.box, animatedStyle]} />;
```

### Entering/Exiting
```tsx
<Animated.View entering={FadeInUp.springify().damping(15)} exiting={FadeOut.duration(200)}>
  {children}
</Animated.View>
```

### Layout Transition (reorder/resize)
```tsx
<Animated.View layout={LinearTransition.springify()}>
  {content}
</Animated.View>
```

### Keyframe
```tsx
const bounce = new Keyframe({
  0: { transform: [{ scale: 0 }] },
  50: { transform: [{ scale: 1.2 }], easing: Easing.out(Easing.exp) },
  100: { transform: [{ scale: 1 }] },
}).duration(600);
<Animated.View entering={bounce} />
```

## Common Mistakes to Avoid

- **Don't read shared values during render** — only inside `useAnimatedStyle` or event handlers
- **Don't mix physics and duration spring configs** — duration overrides physics when both are set
- **Don't forget `Animated.` prefix** — `View` won't animate, `Animated.View` will
- **Don't nest layout animations carelessly** — parent and child both having `layout` can conflict
- **Always clean up** — `cancelAnimation(sharedValue)` in cleanup if starting animations in effects
