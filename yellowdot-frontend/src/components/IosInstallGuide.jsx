/**
 * IosInstallGuide.jsx — branded "Add to Home Screen" instructions for iOS Safari
 * ────────────────────────────────────────────────────────────────────────────
 * iOS Safari never fires `beforeinstallprompt`, so there is no native prompt
 * to trigger — the only path to install is a manual Share → Add to Home
 * Screen flow. This modal walks the user through it with icons matching the
 * actual Safari toolbar controls.
 *
 * Opened from InstallContext's `iosGuideOpen` state — shared by the auto
 * banner, the Login page link, the Sidebar footer button, and Settings →
 * About, so every entry point shows the exact same guide.
 */

import { Share, SquarePlus, Check } from "lucide-react";
import Modal from "./ui/Modal";
import { PLATFORM_NAME } from "../config/environment";
import { useInstall } from "../contexts/InstallContext";

const STEPS = [
  {
    icon: <ShareIcon />,
    title: "Tap the Share icon",
    desc: "Find it in Safari's toolbar (bottom bar on iPhone, top bar on iPad).",
  },
  {
    icon: <AddSquareIcon />,
    title: 'Scroll down and tap "Add to Home Screen"',
    desc: "It's in the list of share options — you may need to scroll a little.",
  },
  {
    icon: <CheckIcon />,
    title: 'Tap "Add" in the top-right corner',
    desc: `${PLATFORM_NAME} will appear on your Home Screen like any other app.`,
  },
];

export default function IosInstallGuide() {
  const { iosGuideOpen, closeIosGuide } = useInstall();

  return (
    <Modal
      isOpen={iosGuideOpen}
      onClose={closeIosGuide}
      title={`Install ${PLATFORM_NAME}`}
      footer={null}
      className="yd-ios-guide"
    >
      <div className="yd-ig-hero">
        <img src="/icons/pwa-192x192.png" alt="" className="yd-ig-icon" />
        <p className="yd-ig-hero-text">
          Add {PLATFORM_NAME} to your Home Screen for one-tap access, a
          full-screen app experience, and offline support.
        </p>
      </div>

      <ol className="yd-ig-steps">
        {STEPS.map((step, i) => (
          <li key={i} className="yd-ig-step">
            <span className="yd-ig-step-num">{i + 1}</span>
            <span className="yd-ig-step-icon">{step.icon}</span>
            <span className="yd-ig-step-copy">
              <span className="yd-ig-step-title">{step.title}</span>
              <span className="yd-ig-step-desc">{step.desc}</span>
            </span>
          </li>
        ))}
      </ol>

      <button className="yd-ig-done-btn" onClick={closeIosGuide}>
        Got it
      </button>
    </Modal>
  );
}

// ── Icons (lucide-react, matching Safari's actual controls) ──────────────────
function ShareIcon() {
  return <Share strokeWidth={2} />;
}

function AddSquareIcon() {
  return <SquarePlus strokeWidth={2} />;
}

function CheckIcon() {
  return <Check strokeWidth={2} />;
}
