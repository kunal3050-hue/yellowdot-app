/**
 * storageService.js — Firebase Storage upload utilities
 */

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/firebase";

/**
 * Upload a single image file to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadIncidentPhoto(file) {
  const ext      = file.name.split(".").pop();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path     = `incidents/${uniqueId}.${ext}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

/**
 * Upload multiple photos and return array of download URLs.
 * Resolves in parallel.
 */
export async function uploadIncidentPhotos(files) {
  return Promise.all(Array.from(files).map(f => uploadIncidentPhoto(f)));
}

/**
 * Upload an artwork image to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadArtwork(file) {
  const ext      = file.name.split(".").pop();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path     = `journey/artwork/${uniqueId}.${ext}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

/**
 * Upload a journey media file (photo/video) to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadJourneyMedia(file) {
  const ext      = file.name.split(".").pop();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path     = `journey/media/${uniqueId}.${ext}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}
