# Animation Functions API Reference

## withTiming

Duration-based animation with easing curve.

```typescript
function withTiming<T extends AnimatableValue>(
  toValue: T,
  config?: WithTimingConfig,
  callback?: (finished?: boolean, current?: AnimatableValue) => void
): T;

interface WithTimingConfig {
  duration?: number;          // Default: 300ms
  easing?: EasingFunction;    // Default: Easing.inOut(Easing.quad)
  reduceMotion?: ReduceMotion;
}
```

**Supported types:** numbers, suffixed strings (`"50%"`, `"90deg"`), colors (hex, rgb, rgba, hsl, named), objects, arrays, transform matrices.

**Easing functions:** `Easing.linear`, `.ease`, `.quad`, `.cubic`, `.poly(n)`, `.sin`, `.circle`, `.exp`, `.elastic(n)`, `.back(n)`, `.bounce`, `.bezier(x1,y1,x2,y2)` + modifiers `.in()`, `.out()`, `.inOut()`

```tsx
sv.value = withTiming(100, { duration: 500, easing: Easing.out(Easing.exp) });

// Color animation
color.value = withTiming('rgba(255, 0, 0, 1)', { duration: 600 });
```

---

## withSpring

Physics-based spring animation.

```typescript
function withSpring<T extends AnimatableValue>(
  toValue: T,
  config?: WithSpringConfig,
  callback?: (finished?: boolean, current?: AnimatableValue) => void
): T;

interface WithSpringConfig {
  // Physics-based (use these OR duration-based, not both)
  damping?: number;        // Default: 120 — how quickly it slows
  stiffness?: number;      // Default: 900 — how bouncy

  // Duration-based (overrides physics when set)
  duration?: number;       // Default: 550ms (perceptual; actual = 1.5x)
  dampingRatio?: number;   // Default: 1 (1 = critically damped, <1 = bouncy)

  // Universal
  mass?: number;           // Default: 4 — lower = faster
  velocity?: number;       // Default: 0 — initial velocity
  overshootClamping?: boolean;  // Default: false
  energyThreshold?: number;     // Default: 6e-9
  clamp?: [number, number];     // Bounds restriction
  reduceMotion?: ReduceMotion;
}
```

**Common presets:**
```tsx
// Snappy (buttons, toggles)
withSpring(target, { damping: 20, stiffness: 300 })

// Bouncy (playful UI)
withSpring(target, { damping: 8, stiffness: 150 })

// Smooth (page transitions)
withSpring(target, { damping: 25, stiffness: 120 })

// Duration-based
withSpring(target, { duration: 800, dampingRatio: 0.7 })
```

---

## withDecay

Friction-based deceleration (e.g., fling gestures).

```typescript
function withDecay(
  config: WithDecayConfig,
  callback?: (finished?: boolean, current?: AnimatableValue) => void
): number;

interface WithDecayConfig {
  velocity?: number;          // Default: 0 — starting speed
  deceleration?: number;      // Default: 0.998 — friction rate
  clamp?: [number, number];   // Bounds
  velocityFactor?: number;    // Default: 1 — velocity multiplier
  rubberBandEffect?: boolean; // Default: false — bounce at bounds
  rubberBandFactor?: number;  // Default: 0.6 — bounce intensity
  reduceMotion?: ReduceMotion;
}
```

```tsx
// After a pan gesture ends:
offset.value = withDecay({
  velocity: event.velocityX,
  clamp: [0, maxWidth],
  rubberBandEffect: true,
});
```

---

## Composition Functions

### withDelay
```typescript
withDelay(delayMs: number, animation: AnimationObject): AnimationObject;
```
```tsx
sv.value = withDelay(300, withTiming(1));
```

### withSequence
```typescript
withSequence(...animations: AnimationObject[]): AnimationObject;
```
```tsx
// Shake animation
sv.value = withSequence(
  withTiming(-10, { duration: 50 }),
  withRepeat(withTiming(10, { duration: 100 }), 3, true),
  withTiming(0, { duration: 50 }),
);
```

### withRepeat
```typescript
withRepeat(
  animation: AnimationObject,
  numberOfReps?: number,  // -1 = infinite
  reverse?: boolean,      // true = ping-pong
  callback?: (finished?: boolean) => void
): AnimationObject;
```
```tsx
// Pulsing animation (infinite)
sv.value = withRepeat(
  withTiming(1.2, { duration: 800 }),
  -1,   // infinite
  true,  // reverse (ping-pong)
);
```

---

## interpolate

Maps a value from one range to another.

```typescript
function interpolate(
  value: number,
  inputRange: number[],
  outputRange: number[],
  extrapolation?: ExtrapolationType | { left?: ExtrapolationType; right?: ExtrapolationType }
): number;

enum Extrapolation {
  CLAMP = 'clamp',     // Caps at boundary values
  EXTEND = 'extend',   // Continues the curve (default)
  IDENTITY = 'identity' // Returns input as-is
}
```

```tsx
const animatedStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.value, [0, 100], [1, 0], Extrapolation.CLAMP),
  transform: [{
    scale: interpolate(scrollY.value, [0, 200], [1, 0.8], Extrapolation.CLAMP),
  }],
}));
```

---

## interpolateColor

```typescript
function interpolateColor(
  value: number,
  inputRange: number[],
  outputRange: string[],  // Color strings
  colorSpace?: 'RGB' | 'HSV'
): string;
```

```tsx
const bgColor = useAnimatedStyle(() => ({
  backgroundColor: interpolateColor(
    progress.value,
    [0, 1],
    ['#FF6B6B', '#4ECDC4'],
  ),
}));
```
