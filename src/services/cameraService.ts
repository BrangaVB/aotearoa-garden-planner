import * as ImagePicker from 'expo-image-picker';

export interface CapturedPhoto {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

export interface PhotoCaptureResult {
  photo?: CapturedPhoto;
  cancelled?: boolean;
  error?: string;
}

const IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.7,
  base64: true
};

export async function captureGardenPhoto(): Promise<PhotoCaptureResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { error: 'Camera permission is required to scan plants and pests.' };
    }

    const result = await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS);
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { cancelled: true };
    }

    const asset = result.assets[0];
    if (!asset?.base64) {
      return { error: 'Photo captured without base64 payload; try picking from gallery.' };
    }

    return {
      photo: {
        uri: asset.uri,
        base64: asset.base64,
        width: asset.width,
        height: asset.height
      }
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Unable to open camera on this device.'
    };
  }
}

export async function pickGardenPhoto(): Promise<PhotoCaptureResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { error: 'Photo library permission is required to upload a garden photo.' };
    }

    const result = await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { cancelled: true };
    }

    const asset = result.assets[0];
    if (!asset?.base64) {
      return { error: 'Selected image could not be encoded for AI analysis.' };
    }

    return {
      photo: {
        uri: asset.uri,
        base64: asset.base64,
        width: asset.width,
        height: asset.height
      }
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Unable to open photo library.'
    };
  }
}
