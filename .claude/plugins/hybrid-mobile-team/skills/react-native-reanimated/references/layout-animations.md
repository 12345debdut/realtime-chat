# Layout Animations API Reference

## Entering/Exiting Animations

Animate components when they mount/unmount from the view hierarchy.

### Usage
```tsx
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

<Animated.View entering={FadeIn} exiting={FadeOut}>
  {children}
</Animated.View>
```

### All Entering Animations

| Category | Animations |
|----------|-----------|
| **Fade** | `FadeIn`, `FadeInRight`, `FadeInLeft`, `FadeInUp`, `FadeInDown` |
| **Slide** | `SlideInRight`, `SlideInLeft`, `SlideInUp`, `SlideInDown` |
| **Zoom** | `ZoomIn`, `ZoomInDown`, `ZoomInUp`, `ZoomInLeft`, `ZoomInRight`, `ZoomInEasyDown`, `ZoomInEasyUp`, `ZoomInRotate` |
| **Bounce** | `BounceIn`, `BounceInRight`, `BounceInLeft`, `BounceInUp`, `BounceInDown` |
| **Flip** | `FlipInEasyX`, `FlipInEasyY`, `FlipInXDown`, `FlipInXUp`, `FlipInYLeft`, `FlipInYRight` |
| **Stretch** | `StretchInX`, `StretchInY` |
| **LightSpeed** | `LightSpeedInRight`, `LightSpeedInLeft` |
| **Rotate** | `RotateInDownLeft`, `RotateInDownRight`, `RotateInUpLeft`, `RotateInUpRight` |
| **Roll** | `RollInRight`, `RollInLeft` |
| **Pinwheel** | `PinwheelIn` |

### All Exiting Animations
Every entering animation has a corresponding exit (e.g., `FadeOut`, `SlideOutLeft`, `ZoomOutDown`, etc.)

### Modifiers

**Time-based:**
```tsx
FadeIn.duration(500)                    // Animation length (default: 300ms)
FadeIn.delay(200)                       // Delay before start
FadeIn.easing(Easing.out(Easing.exp))  // Custom easing curve
```

**Spring-based:**
```tsx
FadeInUp.springify()           // Enable spring physics
  .damping(15)                 // Default: 10 — how fast it stops
  .mass(1)                     // Default: 1 — weight
  .stiffness(100)              // Default: 100 — bounciness
  .overshootClamping(false)    // Default: false — allow overshoot
```

**Common:**
```tsx
FadeIn.randomDelay()                           // Random delay between 0 and specified
FadeIn.withInitialValues({ opacity: 0.5 })     // Override start state
FadeIn.withCallback((finished) => {            // Post-animation callback
  'worklet';
  if (finished) runOnJS(onComplete)();
})
FadeIn.reduceMotion(ReduceMotion.Never)        // Accessibility
```

**Chaining example:**
```tsx
<Animated.View
  entering={SlideInRight.duration(400).delay(index * 100).springify().damping(18)}
  exiting={FadeOut.duration(200)}
>
```

---

## Layout Transitions

Animate components when their position/size changes within the layout.

### Usage
```tsx
<Animated.View layout={LinearTransition.springify()}>
  {content}
</Animated.View>
```

### Available Transitions

| Transition | Description | Default Duration |
|-----------|-------------|-----------------|
| `LinearTransition` | Uniform position + size animation | 300ms |
| `SequencedTransition` | X/width first, then Y/height | 500ms |
| `FadingTransition` | Fades out at old position, fades in at new | 300ms |
| `JumpingTransition` | Jumping motion between positions | 300ms |
| `CurvedTransition` | Independent easing per axis (X, Y, W, H) | 300ms |
| `EntryExitTransition` | Combines entering + exiting animations | 300ms |

### Modifier Examples

```tsx
// Spring-based reorder
LinearTransition.springify().damping(20).stiffness(200)

// Sequenced with reverse
SequencedTransition.duration(600).reverse()

// Curved with per-axis easing
CurvedTransition
  .easingX(Easing.out(Easing.exp))
  .easingY(Easing.in(Easing.quad))
  .duration(400)

// Entry/Exit combo
EntryExitTransition
  .entering(ZoomIn.springify())
  .exiting(FadeOut.duration(150))
```

---

## Keyframe Animations

Define complex multi-step animations using percentage-based keyframes.

```tsx
import { Keyframe } from 'react-native-reanimated';

const pulseAndFade = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ scale: 0.5 }],
  },
  50: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
    easing: Easing.out(Easing.exp),  // Easing goes on second+ keyframe
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
}).duration(800);

// Alternative: use 'from' and 'to'
const fadeSlide = new Keyframe({
  from: { opacity: 0, transform: [{ translateX: -50 }] },
  to: { opacity: 1, transform: [{ translateX: 0 }] },
}).duration(400).delay(200);

<Animated.View entering={pulseAndFade} />
```

**Rules:**
- Always provide initial values for ALL animated properties at keyframe 0
- Don't apply easing to keyframe 0 — only to subsequent keyframes
- Don't mix `0`/`from` or `100`/`to` in the same definition
- Keep transform array property order consistent across all keyframes
