# Moti API Reference

## MotiView / MotiText / MotiImage

Core animated components. Drop-in replacements for `View`, `Text`, `Image`.

```tsx
import { MotiView, MotiText, MotiImage } from 'moti';
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `from` | `StyleObject` | Initial style (before animation starts) |
| `animate` | `StyleObject` | Target style (animates to this) |
| `exit` | `StyleObject` | Style to animate to on unmount (requires `AnimatePresence`) |
| `transition` | `TransitionConfig` | Animation timing/spring config |
| `exitTransition` | `TransitionConfig` | Override transition for exit only |
| `delay` | `number` | Delay in ms before animation starts |
| `state` | `ReturnType<typeof useAnimationState>` | State machine (mutually exclusive with `animate`) |
| `stylePriority` | `'animate' \| 'state'` | Which takes precedence (default: `'animate'`) |

### Supported Style Properties

Numbers, colors, transforms — same as Reanimated:
- `opacity`, `scale`, `translateX`, `translateY`, `rotate`, `skewX`, `skewY`
- `backgroundColor`, `borderColor`, `color` (MotiText)
- `width`, `height`, `borderRadius`, `borderWidth`
- `top`, `left`, `right`, `bottom`

### Basic Examples

```tsx
// Fade + slide up on mount
<MotiView
  from={{ opacity: 0, translateY: 50 }}
  animate={{ opacity: 1, translateY: 0 }}
  transition={{ type: 'timing', duration: 400 }}
>
  <Text>Hello</Text>
</MotiView>

// Spring animation
<MotiView
  from={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
/>

// Staggered list items
{items.map((item, i) => (
  <MotiView
    key={item.id}
    from={{ opacity: 0, translateX: -20 }}
    animate={{ opacity: 1, translateX: 0 }}
    transition={{ delay: i * 100 }}
  />
))}

// Dynamic animate (responds to state changes)
<MotiView
  animate={{ backgroundColor: isActive ? '#4ECDC4' : '#ccc' }}
  transition={{ type: 'timing', duration: 300 }}
/>
```

---

## AnimatePresence

Enables exit animations when components unmount. Wraps conditionally rendered Moti components.

```tsx
import { AnimatePresence } from 'moti';
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `exitBeforeEnter` | `boolean` | `false` | Wait for exiting component to finish before mounting new one |
| `presenceAffectsLayout` | `boolean` | `true` | Whether exiting elements affect layout flow |
| `onExitComplete` | `() => void` | — | Callback when all exit animations complete |

### Usage

```tsx
<AnimatePresence>
  {showToast && (
    <MotiView
      key="toast"
      from={{ opacity: 0, translateY: -30 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -30 }}
      transition={{ type: 'spring', damping: 20 }}
    />
  )}
</AnimatePresence>
```

### Swapping Components

```tsx
<AnimatePresence exitBeforeEnter>
  {screen === 'login' ? (
    <MotiView
      key="login"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <LoginScreen />
    </MotiView>
  ) : (
    <MotiView
      key="home"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <HomeScreen />
    </MotiView>
  )}
</AnimatePresence>
```

**Rules:**
- Every direct child must have a unique `key`
- The `exit` prop only works inside `AnimatePresence`
- Without `AnimatePresence`, unmounted components disappear instantly

---

## useAnimationState

State-machine driven animations. Define named states with style objects, transition between them imperatively.

```tsx
import { useAnimationState, MotiView } from 'moti';
```

### API

```typescript
function useAnimationState<States extends Record<string, StyleObject>>(
  states: States,
  config?: { from?: keyof States }
): {
  current: keyof States;
  transitionTo: (state: keyof States) => void;
  __state: SharedValue;  // internal
};
```

### Usage

```tsx
const animationState = useAnimationState({
  closed: { height: 0, opacity: 0 },
  open: { height: 200, opacity: 1 },
});

// Trigger
const toggle = () => {
  animationState.transitionTo(
    animationState.current === 'open' ? 'closed' : 'open'
  );
};

// Render
<MotiView state={animationState} transition={{ type: 'spring', damping: 18 }} />
```

### With Initial State

```tsx
const state = useAnimationState(
  {
    inactive: { opacity: 0.5, scale: 0.95 },
    active: { opacity: 1, scale: 1 },
    pressed: { opacity: 0.8, scale: 0.9 },
  },
  { from: 'inactive' }  // Start from this state
);
```

**Rules:**
- Don't use `animate` prop together with `state` prop
- `from` in config sets the initial state name (defaults to first key)
- Transitions are animated with the component's `transition` prop

---

## Skeleton

Shimmer loading placeholder component from `moti/skeleton`.

```tsx
import { Skeleton } from 'moti/skeleton';
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `colorMode` | `'light' \| 'dark'` | `'light'` | Theme for shimmer colors |
| `colors` | `string[]` | — | Custom gradient colors (overrides colorMode) |
| `width` | `number \| string` | `'100%'` | Skeleton width |
| `height` | `number` | `32` | Skeleton height |
| `radius` | `number \| 'square' \| 'round'` | `8` | Border radius (`'round'` = circle) |
| `show` | `boolean` | — | When `true`, hides skeleton and shows children |
| `transition` | `TransitionConfig` | — | Animation config for shimmer |
| `backgroundColor` | `string` | — | Override background color |

### Usage

```tsx
// Basic placeholder
<Skeleton colorMode="dark" width={250} height={20} />

// Circular avatar placeholder
<Skeleton colorMode="light" radius="round" width={48} height={48} />

// Reveal content when loaded
<Skeleton colorMode="light" width={200} show={!!user}>
  <Text>{user?.name}</Text>
</Skeleton>

// Custom colors
<Skeleton
  colors={['#e1e1e1', '#f2f2f2', '#e1e1e1']}
  width="100%"
  height={16}
/>
```

### Loading Card Pattern

```tsx
function UserCard({ user, loading }: Props) {
  const colorMode = 'light';

  return (
    <View style={styles.card}>
      <Skeleton colorMode={colorMode} radius="round" width={48} height={48} show={!loading}>
        <Avatar uri={user?.avatar} />
      </Skeleton>

      <View style={styles.info}>
        <Skeleton colorMode={colorMode} width={120} height={16} show={!loading}>
          <Text style={styles.name}>{user?.name}</Text>
        </Skeleton>

        <Spacer height={8} />

        <Skeleton colorMode={colorMode} width={180} height={14} show={!loading}>
          <Text style={styles.bio}>{user?.bio}</Text>
        </Skeleton>
      </View>
    </View>
  );
}
```

**Requirements:**
- Requires `react-native-reanimated` (peer dependency)
- Requires `@motify/skeleton` or import from `moti/skeleton`
- Requires `expo-linear-gradient` or `react-native-linear-gradient`

---

## Transition Config

Controls how animations move. Applied via the `transition` prop on any Moti component.

### Types

```typescript
type TransitionConfig = {
  type?: 'timing' | 'spring' | 'decay';

  // Timing options
  duration?: number;          // Default: 300ms
  easing?: EasingFunction;    // From react-native-reanimated

  // Spring options (when type: 'spring')
  damping?: number;           // Default: 10
  stiffness?: number;         // Default: 100
  mass?: number;              // Default: 1
  overshootClamping?: boolean;

  // Universal
  delay?: number;             // Delay in ms
  repeat?: number;            // Number of repetitions
  repeatReverse?: boolean;    // Ping-pong
  loop?: boolean;             // Infinite loop (shorthand for repeat: Infinity, repeatReverse: true)
};
```

### Per-Property Transitions

Override transition config for specific style properties:

```tsx
<MotiView
  from={{ opacity: 0, scale: 0.5, translateY: 30 }}
  animate={{ opacity: 1, scale: 1, translateY: 0 }}
  transition={{
    type: 'spring',
    damping: 18,
    // Override for specific properties
    opacity: { type: 'timing', duration: 200 },
    translateY: { type: 'spring', damping: 12, delay: 100 },
  }}
/>
```

### Loop / Repeat

```tsx
// Pulsing animation
<MotiView
  from={{ opacity: 0.5 }}
  animate={{ opacity: 1 }}
  transition={{
    type: 'timing',
    duration: 800,
    loop: true,        // infinite ping-pong
  }}
/>

// Repeat 3 times
<MotiView
  from={{ translateX: -5 }}
  animate={{ translateX: 5 }}
  transition={{
    type: 'timing',
    duration: 80,
    repeat: 3,
    repeatReverse: true,
  }}
/>
```

---

## Sequence Animations

Chain multiple animation steps using arrays in the `animate` prop.

```tsx
// Shake animation
<MotiView
  animate={{
    translateX: [0, -10, 10, -10, 10, 0],
  }}
  transition={{
    translateX: {
      type: 'timing',
      duration: 400,
    },
  }}
/>
```

### With Per-Step Config

Each array element can be an object with `value` and optional transition overrides:

```tsx
<MotiView
  animate={{
    scale: [
      { value: 1, type: 'timing', duration: 0 },       // instant reset
      { value: 1.2, type: 'spring', damping: 10 },      // bounce up
      { value: 1, type: 'timing', duration: 200 },      // settle
    ],
  }}
/>
```

---

## Common Patterns

### Fade-in List Items
```tsx
function AnimatedList({ items }: { items: Item[] }) {
  return (
    <FlatList
      data={items}
      renderItem={({ item, index }) => (
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: index * 80, damping: 18 }}
        >
          <ListItem item={item} />
        </MotiView>
      )}
    />
  );
}
```

### Press Feedback
```tsx
function PressableCard({ children, onPress }: Props) {
  const state = useAnimationState({
    default: { scale: 1, opacity: 1 },
    pressed: { scale: 0.97, opacity: 0.8 },
  });

  return (
    <Pressable
      onPressIn={() => state.transitionTo('pressed')}
      onPressOut={() => state.transitionTo('default')}
      onPress={onPress}
    >
      <MotiView state={state} transition={{ type: 'spring', damping: 20, stiffness: 300 }}>
        {children}
      </MotiView>
    </Pressable>
  );
}
```

### Conditional Toast
```tsx
function Toast({ message, visible }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          key="toast"
          from={{ opacity: 0, translateY: -40, scale: 0.95 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          exit={{ opacity: 0, translateY: -40, scale: 0.95 }}
          exitTransition={{ type: 'timing', duration: 200 }}
          transition={{ type: 'spring', damping: 20 }}
          style={styles.toast}
        >
          <Text>{message}</Text>
        </MotiView>
      )}
    </AnimatePresence>
  );
}
```
