import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { SETTING, setSetting } from '@/db/settingsRepo';
import { LEAD, WINDOW_RADIUS, roseWindowPieces, type Piece } from '@/domain/roseWindow';
import { space, type } from '@/theme/theme';

// The welcome Kathryn sees the first time she opens the app: pieces of colored glass
// fly in and settle into a rose window, the lead lines close around them, light passes
// through, and the window glows. Tap anywhere to skip. Replay it from Settings.

const NIGHT = '#18203A';
const native = Platform.OS !== 'web';
const VIEWBOX = '-110 -110 220 220';

export default function WelcomeScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.78, height * 0.42, 400);
  const pieces = useMemo(() => roseWindowPieces(), []);
  const flights = useMemo(() => planFlights(pieces, size), [pieces, size]);

  // Animated values are made once and kept; React never needs to re-render for them.
  const [{ progress, lead, sweep, glow, words }] = useState(() => ({
    progress: pieces.map(() => new Animated.Value(0)),
    lead: new Animated.Value(0),
    sweep: new Animated.Value(0),
    glow: new Animated.Value(0),
    words: [0, 1, 2, 3, 4].map(() => new Animated.Value(0)),
  }));
  const [done, setDone] = useState(false);
  const [showSkip, setShowSkip] = useState(true);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const showEnd = () => {
    running.current?.stop();
    progress.forEach((p) => p.setValue(1));
    lead.setValue(1);
    glow.setValue(1);
    sweep.setValue(1);
    Animated.stagger(
      120,
      words.map((w) => Animated.timing(w, { toValue: 1, duration: 350, useNativeDriver: native })),
    ).start();
    setDone(true);
  };

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) return showEnd();

        const fly = Animated.stagger(
          55,
          flights.order.map((i) => Animated.spring(progress[i], { toValue: 1, damping: 13, stiffness: 80, mass: 0.9, useNativeDriver: native })),
        );
        const close = Animated.timing(lead, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: native });
        const light = Animated.parallel([
          Animated.timing(sweep, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }),
          Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        ]);
        const text = Animated.stagger(
          380,
          words.map((w) => Animated.timing(w, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: native })),
        );

        running.current = Animated.sequence([Animated.delay(350), fly, Animated.delay(150), close]);
        running.current.start(({ finished }) => {
          if (!finished || cancelled) return;
          setShowSkip(false);
          tap('soft');
          running.current = Animated.sequence([light, text]);
          running.current.start(({ finished: f }) => {
            if (f && !cancelled) setDone(true);
          });
          setTimeout(() => !cancelled && tap('success'), 700);
        });
      });
    return () => {
      cancelled = true;
      running.current?.stop();
    };
    // Plays once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = async () => {
    await setSetting(db, SETTING.welcomeSeen, new Date().toISOString()).catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const rise = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <Pressable
      style={[styles.screen, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}
      onPress={done ? undefined : showEnd}
      accessible={!done}
      accessibilityLabel={done ? undefined : 'Welcome animation. Tap to skip.'}
    >
      <View style={[styles.stage, { width: size * 1.35, height: size * 1.35 }]}>
        {/* Warm light behind the window once it's whole. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
          ]}
        >
          <Svg width="100%" height="100%" viewBox="-150 -150 300 300">
            <Defs>
              <RadialGradient id="halo">
                <Stop offset="0.45" stopColor="#FFE7A8" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#FFE7A8" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle r="150" fill="url(#halo)" />
          </Svg>
        </Animated.View>

        <View style={{ width: size, height: size }}>
          {/* The lead that holds it all together. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: lead }]}>
            <Svg width={size} height={size} viewBox={VIEWBOX}>
              <Circle r={WINDOW_RADIUS} fill={LEAD} />
            </Svg>
          </Animated.View>

          {pieces.map((p, i) => {
            const f = flights.paths[i];
            const v = progress[i];
            return (
              <Animated.View
                key={p.id}
                style={[
                  StyleSheet.absoluteFill,
                  {
                    opacity: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
                    transform: [
                      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [f.dx, 0] }) },
                      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [f.dy, 0] }) },
                      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${f.turn}deg`, '0deg'] }) },
                      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
                    ],
                  },
                ]}
              >
                <Svg width={size} height={size} viewBox={VIEWBOX}>
                  <Path d={p.d} fill={p.fill} stroke={LEAD} strokeWidth={3} strokeLinejoin="round" />
                </Svg>
              </Animated.View>
            );
          })}

          <Animated.View style={[StyleSheet.absoluteFill, { opacity: lead }]}>
            <Svg width={size} height={size} viewBox={VIEWBOX}>
              <Circle r={WINDOW_RADIUS - 2} fill="none" stroke={LEAD} strokeWidth={6} />
            </Svg>
          </Animated.View>

          {/* Sunlight passing across the glass. */}
          <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: 'hidden' }]} pointerEvents="none">
            <Animated.View
              style={{
                position: 'absolute',
                top: -size * 0.3,
                width: size * 0.5,
                height: size * 1.6,
                opacity: sweep.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.6, size * 1.1] }) }, { rotate: '18deg' }],
              }}
            >
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                    <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.6" />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#beam)" />
              </Svg>
            </Animated.View>
          </View>
        </View>
      </View>

      <View style={styles.words}>
        <Animated.Text style={[styles.wordmark, rise(words[0])]} accessibilityRole="header">
          KATHAROS
        </Animated.Text>
        <Animated.Text style={[styles.forName, rise(words[1])]}>For Kathryn</Animated.Text>
        <Animated.Text style={[styles.line, rise(words[2])]}>Every piece in its place.</Animated.Text>
        <Animated.Text style={[styles.small, rise(words[3])]}>
          Katharos is Greek for pure and clear, a word long tied to your name.{'\n'}Made with love by Taylor.
        </Animated.Text>
        <Animated.View style={[styles.buttonWrap, rise(words[4])]} pointerEvents={done ? 'auto' : 'none'}>
          <Pressable onPress={begin} accessibilityRole="button" style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}>
            <Text style={styles.buttonText}>Let’s begin</Text>
          </Pressable>
        </Animated.View>
      </View>

      {!done && showSkip && (
        <Text style={[styles.skip, { top: insets.top + space.sm }]} accessibilityElementsHidden importantForAccessibility="no">
          Tap to skip
        </Text>
      )}
    </Pressable>
  );
}

/** Where each piece starts, and the order they arrive in: center, petals, then the outer ring clockwise. */
function planFlights(pieces: Piece[], size: number) {
  const rand = seeded(1952);
  const paths = pieces.map((p) => {
    const len = Math.hypot(p.cx, p.cy) || 1;
    const [ux, uy] = p.ring === 0 ? [0, 1] : [p.cx / len, p.cy / len];
    const far = size * (0.75 + rand() * 0.55);
    const side = (rand() - 0.5) * size * 0.5;
    return {
      dx: ux * far - uy * side,
      dy: uy * far + ux * side,
      turn: Math.round((rand() - 0.5) * 240),
    };
  });
  const angle = (p: Piece) => (Math.atan2(p.cy, p.cx) + Math.PI * 2.5) % (Math.PI * 2);
  const order = pieces
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.ring - b.p.ring || angle(a.p) - angle(b.p))
    .map((x) => x.i);
  return { paths, order };
}

/** The same "random" scatter every time, so the welcome always looks the way it was designed. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tap(kind: 'soft' | 'success') {
  if (Platform.OS !== 'ios') return;
  if (kind === 'soft') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

const script = Platform.select({ ios: 'SnellRoundhand-Bold', android: 'serif', default: 'Georgia, "Times New Roman", serif' });

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  stage: { alignItems: 'center', justifyContent: 'center' },
  words: { alignItems: 'center', gap: space.sm, marginTop: -space.lg, maxWidth: 520 },
  wordmark: { color: '#C9B6F2', fontSize: type.label, fontWeight: '700', letterSpacing: 8, textAlign: 'center', marginRight: -8 },
  forName: {
    color: '#FFF4DA',
    fontFamily: script,
    fontSize: Platform.OS === 'ios' ? 52 : 44,
    fontStyle: Platform.OS === 'ios' ? 'normal' : 'italic',
    textAlign: 'center',
  },
  line: { color: '#E6DDF9', fontSize: type.heading, fontWeight: '600', textAlign: 'center' },
  small: { color: '#B9C2DA', fontSize: type.label, lineHeight: type.label * 1.45, textAlign: 'center', marginTop: space.xs },
  buttonWrap: { marginTop: space.lg, alignSelf: 'stretch' },
  button: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#C9B6F2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  buttonText: { color: '#1C2540', fontSize: type.body, fontWeight: '700' },
  skip: { position: 'absolute', right: space.lg, color: '#8C96B4', fontSize: type.small },
});
