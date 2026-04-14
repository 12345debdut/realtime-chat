# Core Hooks API Reference

## useSharedValue

Creates a mutable value that can be shared between JS and UI threads.

```typescript
function useSharedValue<Value>(initialValue: Value): SharedValue<Value>;

interface SharedValue<Value = unknown> {
  value: Value;                    // Read/write (legacy)
  get(): Value;                    // Read (React Compiler safe)
  set(value: Value | ((value: Value) => Value)): void;  // Write (React Compiler safe)
  modify(modifier?: (value: Value) => Value, forceUpdate?: boolean): void;
}
```

**Rules:**
- Don't read/modify during component render — only in worklets, event handlers, or effects
- Don't destructure: `const { value } = sv` ❌ — use `sv.value` ✅
- For objects/arrays, use `.modify()` or reassign entirely (not property mutations)

```tsx
const offset = useSharedValue(0);
const items = useSharedValue([1, 2, 3]);

// Correct: modify for in-place mutations
items.modify((arr) => { arr.push(4); return arr; });

// Correct: full reassignment
items.value = [...items.value, 4];
```

---

## useAnimatedStyle

Creates a style object that reactively updates when shared values change. Runs on the UI thread.

```typescript
function useAnimatedStyle<Style extends DefaultStyle>(
  updater: () => Style,
  dependencies?: DependencyList | null
): Style;
```

**Rules:**
- Never mutate shared values inside the updater
- Only apply to `Animated.*` components
- Merge with static styles: `style={[styles.box, animatedStyles]}`
- Animated styles override static ones regardless of array order

```tsx
const translateY = useSharedValue(0);

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: translateY.value }],
  opacity: interpolate(translateY.value, [0, 100], [1, 0]),
}));

return <Animated.View style={[styles.container, animatedStyle]} />;
```

---

## useDerivedValue

Creates a read-only shared value derived from other shared values. Auto-workletized.

```typescript
function useDerivedValue<T>(
  updater: () => T,
  dependencies?: DependencyList
): DerivedValue<T>;
```

```tsx
const x = useSharedValue(0);
const y = useSharedValue(0);
const distance = useDerivedValue(() => Math.sqrt(x.value ** 2 + y.value ** 2));
```

---

## useAnimatedProps

Creates animated props for non-style properties (e.g., SVG attributes, TextInput text).

```typescript
function useAnimatedProps<Props extends object>(
  updater: () => Partial<Props>,
  dependencies?: DependencyList | null
): Partial<Props>;
```

```tsx
const animatedProps = useAnimatedProps(() => ({
  text: `Value: ${Math.round(sv.value)}`,
}));
return <AnimatedTextInput animatedProps={animatedProps} />;
```

---

## useAnimatedRef / measure / scrollTo

```typescript
const animatedRef = useAnimatedRef<Animated.View>();
// In worklet:
const measurement = measure(animatedRef); // { x, y, width, height, pageX, pageY }
scrollTo(animatedRef, 0, offset, true); // (ref, x, y, animated)
```

---

## useAnimatedScrollHandler

```tsx
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (event) => {
    offset.value = event.contentOffset.y;
  },
  onBeginDrag: (event) => { ... },
  onEndDrag: (event) => { ... },
  onMomentumBegin: (event) => { ... },
  onMomentumEnd: (event) => { ... },
});

return <Animated.ScrollView onScroll={scrollHandler} />;
```

---

## runOnJS / runOnUI

Bridge between threads:

```tsx
// Call JS function from UI thread worklet
const showAlert = (msg: string) => Alert.alert(msg);

const handler = useAnimatedScrollHandler({
  onScroll: (event) => {
    if (event.contentOffset.y > 500) {
      runOnJS(showAlert)('Scrolled past 500!');
    }
  },
});

// Call UI worklet from JS thread
runOnUI(() => {
  'worklet';
  sv.value = withSpring(100);
})();
```

---

## cancelAnimation

Stops an in-progress animation on a shared value:

```typescript
cancelAnimation(sharedValue: SharedValue): void;
```

```tsx
useEffect(() => {
  sv.value = withRepeat(withTiming(100, { duration: 1000 }), -1, true);
  return () => cancelAnimation(sv);
}, []);
```
