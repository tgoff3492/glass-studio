import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { normalizeBarcode } from '@/domain/glass';
import { space, type, useColors } from '@/theme/theme';

// The common retail and shipping symbologies. QR is included because some
// studios print their own QR labels for jars and bins.
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr', 'datamatrix'];

/** Browsers without the Barcode Detection API (Safari, for one) can't scan, only type. */
const canScan = Platform.OS !== 'web' || (typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis);

type Props = {
  onCode: (code: string) => void;
  onCancel: () => void;
};

/** Live camera scanning, with a typed fallback for torn labels or a denied camera. */
export function BarcodeScanner({ onCode, onCancel }: Props) {
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | undefined>();
  // The camera reports the same code many times a second; act on the first one only.
  const handled = useRef(false);

  const submitTyped = () => {
    const code = normalizeBarcode(typed);
    if (code === '') {
      setTypedError('Type the numbers under the barcode.');
      return;
    }
    onCode(code);
  };

  let camera: React.ReactNode;
  if (!canScan) {
    camera = (
      <Message>{"This browser can't read barcodes with the camera. Type the code below instead. The iPhone and iPad app scans normally."}</Message>
    );
  } else if (!permission) {
    camera = <View style={[styles.camera, { backgroundColor: '#000' }]} />;
  } else if (!permission.granted) {
    camera = (
      <View style={[styles.camera, styles.ask, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.body, { color: c.text }]}>
          {permission.canAskAgain
            ? 'Glass Studio needs the camera to read barcodes.'
            : 'Camera access is off. Turn it on in Settings → Glass Studio, or type the code below.'}
        </Text>
        {permission.canAskAgain && <Button label="Allow camera" onPress={requestPermission} />}
      </View>
    );
  } else {
    camera = (
      <View style={styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={(result) => {
            if (handled.current || !result.data) return;
            handled.current = true;
            onCode(normalizeBarcode(result.data));
          }}
        />
        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.frame} />
          <Text style={styles.frameText}>Line up the barcode inside the box</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {camera}
      <Field
        label="Or type the code"
        placeholder="Numbers under the barcode"
        value={typed}
        onChangeText={(t) => {
          setTyped(t);
          setTypedError(undefined);
        }}
        error={typedError}
        keyboardType="number-pad"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={submitTyped}
      />
      <Button label="Look up this code" variant="secondary" onPress={submitTyped} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </View>
  );
}

function Message({ children }: { children: string }) {
  const c = useColors();
  return (
    <View style={[styles.camera, styles.ask, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.body, { color: c.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  camera: { width: '100%', aspectRatio: 4 / 3, maxHeight: 420, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  ask: { borderWidth: 1, padding: space.lg, gap: space.md, justifyContent: 'center' },
  body: { fontSize: type.body, lineHeight: type.body * 1.4 },
  frameWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: space.md },
  frame: { width: '78%', height: '38%', borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 12 },
  frameText: {
    color: '#FFFFFF',
    fontSize: type.label,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
