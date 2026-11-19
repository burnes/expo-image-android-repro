import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// 38 public MIT-licensed SVG icons (Tabler Icons via jsDelivr).
const ICONS = [
  'home', 'star', 'heart', 'bell', 'camera', 'cloud', 'user', 'settings', 'search', 'mail',
  'phone', 'map', 'flag', 'book', 'bolt', 'car', 'clock', 'calendar', 'music', 'photo',
  'lock', 'key', 'gift', 'globe', 'leaf', 'moon', 'sun', 'trash', 'tool', 'truck',
  'umbrella', 'wifi', 'anchor', 'apple', 'bike', 'bug', 'code', 'compass',
];
const BASE = 'https://cdn.jsdelivr.net/npm/@tabler/icons@3.31.0/icons/outline';
const ROUNDS = 10;
const TIMEOUT_MS = 15000;
// Two box sizes per URL, mounted at the same time.
const SIZES = [
  { width: 105, height: 24 },
  { width: 140, height: 32 },
];

// A unique query string per round gives never-cached URLs without clearing app data.
function freshUrls(tag: string) {
  const run = `${tag}-${Date.now()}`;
  return ICONS.map((name) => `${BASE}/${name}.svg?run=${run}`);
}

function log(msg: string) {
  console.log(`REPRO ${msg}`);
}

type Screen = 'home' | 'prefetch' | 'sizes';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [runId, setRunId] = useState(0);
  const back = () => setScreen('home');
  const again = () => setRunId((n) => n + 1);

  if (screen === 'prefetch') {
    return <PrefetchTest key={runId} onBack={back} onAgain={again} />;
  }
  if (screen === 'sizes') {
    return <TwoSizesTest key={runId} onBack={back} onAgain={again} />;
  }
  return (
    <View style={styles.container}>
      <Text style={styles.title}>expo-image Android repro</Text>
      <Text style={styles.text}>Every round uses fresh, never-cached URLs.</Text>
      <Button
        preferred
        label="Test 1: Image.prefetch() never settles"
        hint={`${ROUNDS} calls, 38 URLs each, ${TIMEOUT_MS / 1000} s timeout`}
        onPress={() => setScreen('prefetch')}
      />
      <Button
        label="Test 2: same SVG in two sizes fails"
        hint={`Up to ${ROUNDS} rounds, 38 URLs × 2 sizes mounted at once; failed views turn red`}
        onPress={() => setScreen('sizes')}
      />
    </View>
  );
}

type TestProps = { onBack: () => void; onAgain: () => void };

function PrefetchTest({ onBack, onAgain }: TestProps) {
  const [lines, setLines] = useState<{ text: string; bad: boolean }[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let timeouts = 0;
      for (let round = 1; round <= ROUNDS; round++) {
        const urls = freshUrls(`p${round}`);
        const start = Date.now();
        const result = await Promise.race([
          Image.prefetch(urls, 'disk').then((ok) => (ok ? 'resolved true' : 'resolved false')),
          new Promise<string>((r) => setTimeout(() => r('TIMEOUT'), TIMEOUT_MS)),
        ]);
        if (cancelled) {
          return;
        }
        const bad = result === 'TIMEOUT';
        if (bad) {
          timeouts++;
        }
        const ms = Date.now() - start;
        log(`prefetch round=${round} result=${result} ms=${ms}`);
        const text = bad
          ? `Round ${round}: never settled (gave up after ${TIMEOUT_MS / 1000} s)`
          : `Round ${round}: ${result} in ${ms} ms`;
        setLines((l) => [...l, { text, bad }]);
      }
      const s = `${timeouts}/${ROUNDS} calls never settled within ${TIMEOUT_MS / 1000} s`;
      log(`prefetch summary: ${s}`);
      setSummary(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test 1: Image.prefetch()</Text>
      <Text style={styles.text}>Expected: every call resolves in well under a second.</Text>
      {lines.map((l, i) => (
        <Text key={i} style={[styles.text, l.bad && styles.bad]}>
          {l.text}
        </Text>
      ))}
      {summary ? (
        <>
          <Text style={[styles.summary, summary.startsWith('0/') ? styles.good : styles.bad]}>
            {summary}
          </Text>
          <Actions onBack={onBack} onAgain={onAgain} />
        </>
      ) : (
        <Text style={styles.text}>
          Round {lines.length + 1} of {ROUNDS} running…
        </Text>
      )}
    </View>
  );
}

type Status = 'ok' | 'failed';

function TwoSizesTest({ onBack, onAgain }: TestProps) {
  const [round, setRound] = useState(1);
  const [urls, setUrls] = useState(() => freshUrls('d1'));
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [finished, setFinished] = useState(false);
  const totalFailed = useRef(0);

  const total = urls.length * SIZES.length;
  const settled = Object.keys(status).length;
  const failed = Object.values(status).filter((s) => s === 'failed').length;

  // Once every view of the round has displayed or failed (or on timeout): a clean round moves
  // on to fresh URLs, a round with a failure stays on screen.
  useEffect(() => {
    if (finished) {
      return;
    }
    const next = () => {
      totalFailed.current += failed;
      log(`display round=${round} failed=${failed}/${total}`);
      if (round < ROUNDS && failed === 0) {
        setRound(round + 1);
        setUrls(freshUrls(`d${round + 1}`));
        setStatus({});
      } else {
        log(`display summary: ${totalFailed.current} failed views in ${round} rounds`);
        setFinished(true);
      }
    };
    const t = setTimeout(next, settled === total ? 500 : TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [settled, failed, total, round, finished]);

  const set = (key: string, s: Status) => setStatus((prev) => ({ ...prev, [key]: s }));

  let headline = `Round ${round}/${ROUNDS}: ${settled - failed} loaded, ${failed} failed`;
  if (finished) {
    headline =
      failed > 0
        ? `Round ${round}: ${failed} of ${total} views failed (red)`
        : `No failure in ${round} rounds`;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Test 2: same SVG in two sizes</Text>
      <Text style={styles.text}>
        Expected: all {total} views load. Stops at the first round with a failure, or after{' '}
        {ROUNDS} clean rounds.
      </Text>
      <Text style={[styles.summary, failed > 0 && styles.bad, finished && failed === 0 && styles.good]}>
        {headline}
      </Text>
      {finished && <Actions onBack={onBack} onAgain={onAgain} />}
      <View key={round} style={styles.grid}>
        {urls.map((url) => (
          // Both sizes of one URL side by side.
          <View key={url} style={styles.pair}>
            {SIZES.map((size, i) => {
              const key = `${url}#${i}`;
              return (
                <View key={key} style={[styles.box, status[key] === 'failed' && styles.boxFailed]}>
                  <Image
                    source={url}
                    contentFit="contain"
                    style={size}
                    onDisplay={() => set(key, 'ok')}
                    onError={(e) => {
                      set(key, 'failed');
                      log(
                        `display round=${round} onError size=${size.width}x${size.height} url=${url} error=${e.error}`,
                      );
                    }}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Actions({ onBack, onAgain }: TestProps) {
  return (
    <View style={styles.row}>
      <Button preferred label="Run again" onPress={onAgain} />
      <Button label="Back" onPress={onBack} />
    </View>
  );
}

function Button(props: { label: string; hint?: string; preferred?: boolean; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      // Lets the TV remote land on the main action first.
      hasTVPreferredFocus={props.preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={props.onPress}
      style={[styles.button, focused && styles.buttonFocused]}
    >
      <Text style={[styles.buttonText, focused && styles.buttonTextFocused]}>{props.label}</Text>
      {props.hint && (
        <Text style={[styles.hint, focused && styles.buttonTextFocused]}>{props.hint}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  text: { fontSize: 14, marginBottom: 4 },
  summary: { fontSize: 16, fontWeight: 'bold', marginVertical: 8 },
  good: { color: '#1a7f37' },
  bad: { color: '#cf222e' },
  row: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  button: { borderWidth: 2, borderColor: '#999', borderRadius: 6, padding: 12, marginVertical: 6 },
  buttonFocused: { borderColor: '#0969da', backgroundColor: '#0969da' },
  buttonText: { fontSize: 16, fontWeight: 'bold' },
  buttonTextFocused: { color: '#fff' },
  hint: { fontSize: 13, color: '#555', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  box: { borderWidth: 1, borderColor: '#ddd' },
  boxFailed: { borderColor: '#cf222e', backgroundColor: '#ffebe9', borderWidth: 2 },
});
