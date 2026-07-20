// lib/uploads.js
//
// Setup:
//   npx expo install expo-image-picker expo-image-manipulator
//
// Flow for any upload: pickImage() -> compressImage() -> uploadMedia()
// -> you get back a public URL to store in avatar_url / image_url /
// media_url on the relevant table row.

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabaseClient";

const MAX_DIMENSION = 1600; // px — plenty for a phone screen, keeps files small
const JPEG_QUALITY = 0.75;
const MAX_VIDEO_DURATION_MS = 15000; // 15s cap for story videos — keeps the format fast

/**
 * Opens the native image picker (library) and returns the picked
 * asset, or null if the user cancelled. Requests permission first.
 */
export async function pickImage({ allowsEditing = true, aspect = [4, 5] } = {}) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Photo library permission is required to add a photo.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing,
    aspect,
    quality: 1, // we compress ourselves below, so grab full quality first
  });

  if (result.canceled) return null;
  return result.assets[0]; // { uri, width, height, ... }
}

/** Opens the camera instead of the library — same return shape as pickImage. */
export async function takePhoto({ allowsEditing = true, aspect = [4, 5] } = {}) {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Camera permission is required to take a photo.");
  }

  const result = await ImagePicker.launchCameraAsync({ allowsEditing, aspect, quality: 1 });
  if (result.canceled) return null;
  return result.assets[0];
}

/** Resize + compress before upload — keeps posts/stories fast to load on slow connections. */
export async function compressImage(uri, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxDimension } }], // height auto-scales to preserve aspect ratio
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return manipulated.uri;
}

/**
 * Uploads a local file URI to the `media` bucket under
 * {folder}/{userId}/{filename}, and returns its public URL.
 * folder must be one of: 'avatars' | 'posts' | 'stories'
 */
export async function uploadMedia({ uri, userId, folder }) {
  if (!["avatars", "posts", "stories"].includes(folder)) {
    throw new Error(`Invalid folder "${folder}" — must be avatars, posts, or stories.`);
  }

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${folder}/${userId}/${filename}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Convenience wrapper: pick from library, compress, upload — the
 * full flow in one call for the common case (post composer, avatar
 * picker, story composer).
 */
export async function pickAndUploadImage({ userId, folder, aspect = [4, 5], fromCamera = false }) {
  const asset = fromCamera ? await takePhoto({ aspect }) : await pickImage({ aspect });
  if (!asset) return null; // user cancelled

  const compressedUri = await compressImage(asset.uri);
  const publicUrl = await uploadMedia({ uri: compressedUri, userId, folder });
  return publicUrl;
}

/**
 * Opens the native picker restricted to videos. Rejects (via alert
 * message thrown) anything over MAX_VIDEO_DURATION_MS rather than
 * silently trimming it — trimming without the user's input tends to
 * cut off the part they actually wanted.
 */
export async function pickVideo() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Photo library permission is required to add a video.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    quality: 1,
    videoMaxDuration: MAX_VIDEO_DURATION_MS / 1000,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];

  if (asset.duration && asset.duration > MAX_VIDEO_DURATION_MS) {
    throw new Error("Story videos can be up to 15 seconds. Please pick a shorter clip.");
  }
  return asset; // { uri, duration (ms), width, height, ... }
}

/** Records a new video directly, capped at 15s in the native recorder UI itself. */
export async function recordVideo() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Camera permission is required to record a video.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    videoMaxDuration: MAX_VIDEO_DURATION_MS / 1000,
    quality: 1,
  });

  if (result.canceled) return null;
  return result.assets[0];
}

/**
 * Uploads a local video file URI to the `media` bucket. No client-side
 * compression here — unlike images, video compression needs either a
 * native module (expo-video-compressor, react-native-compressor) or
 * server-side processing, both heavier than this pass covers. Ask if
 * you want that added; for now the 15s cap keeps raw file sizes
 * reasonable (typically a few MB on a phone camera at 1080p).
 */
export async function uploadVideo({ uri, userId, folder = "stories", durationSeconds }) {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
  const path = `${folder}/${userId}/${filename}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(path, arrayBuffer, { contentType: "video/mp4", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl, durationSeconds };
}

/** Full flow for a story video: pick-or-record -> upload -> { url, durationSeconds }. */
export async function pickAndUploadVideo({ userId, fromCamera = false }) {
  const asset = fromCamera ? await recordVideo() : await pickVideo();
  if (!asset) return null; // user cancelled

  const durationSeconds = asset.duration ? Math.round(asset.duration / 1000) : null;
  return uploadVideo({ uri: asset.uri, userId, folder: "stories", durationSeconds });
}


export async function deleteMedia(publicUrl) {
  // Public URLs look like: https://xxx.supabase.co/storage/v1/object/public/media/<path>
  const marker = "/media/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return; // not a recognizable media URL, nothing to do
  const path = publicUrl.slice(idx + marker.length);

  const { error } = await supabase.storage.from("media").remove([path]);
  if (error) throw error;
}
