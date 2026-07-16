/**
 * shared.js — HTTP helpers and pure utility functions shared across the
 * Students module. Extracted unchanged from the original Students.jsx
 * during the Design System v2 Phase 2.2 restructure (folder-per-module,
 * one file per profile tab) — no endpoint, payload, or behavior changes.
 */
import { api } from "../../services/authService";

export const get  = url      => api.get(url).then(r => r.data);
export const post = (url, d) => api.post(url, d).then(r => r.data);
export const put  = (url, d) => api.put(url, d).then(r => r.data);
export const del  = url      => api.delete(url).then(r => r.data);

export function calcAge(dob) {
  if (!dob) return "—";
  const raw = dob.includes("/") ? dob.split("/").reverse().join("-") : dob;
  const d = new Date(raw.replace(/-([A-Za-z]+)-/, (_, m) => {
    const mo = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    return `-${String(mo[m] !== undefined ? mo[m] + 1 : 1).padStart(2,"0")}-`;
  }));
  if (isNaN(d)) return "—";
  const diff = Date.now() - d.getTime();
  const y = Math.floor(diff / (365.25 * 864e5));
  const mo = Math.floor((diff % (365.25 * 864e5)) / (30.44 * 864e5));
  return y >= 1 ? `${y}y ${mo}m` : `${mo} mo`;
}

export function initials(name = "") {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export function compressImage(file, w = 200, h = 200, q = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(w / img.width, h / img.height);
        const sw = w / scale, sh = h / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", q));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const CLASSES  = ["Daycare","Playgroup","Nursery","LKG","UKG","Class 1","Class 2","Class 3","Class 4","Class 5"];
export const GENDERS  = ["Male","Female","Other"];
export const CENTERS  = ["Seawoods","Vashi","Kharghar","Belapur"];
export const STATUSES = ["Active","Inactive","Alumni"];
