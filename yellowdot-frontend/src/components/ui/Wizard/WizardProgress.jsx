/**
 * WizardProgress — step indicator, horizontal or vertical.
 * Renders numbered circles connected by a progress line; supports
 * completed / current / optional / locked visual states.
 */
import { Check, Lock } from "lucide-react";

export default function WizardProgress({ steps, currentIndex, furthestIndex, orientation, onStepClick }) {
  return (
    <ol className={`yd-wiz-progress yd-wiz-progress--${orientation}`} aria-label="Progress">
      {steps.map((step, i) => {
        const completed = i < currentIndex;
        const isCurrent = i === currentIndex;
        const reachable = i <= furthestIndex && !step.locked;
        const locked = !!step.locked && i > furthestIndex;

        return (
          <li key={step.key} className="yd-wiz-progress-item">
            <button
              type="button"
              className={[
                "yd-wiz-progress-dot",
                isCurrent && "yd-wiz-progress-dot--current",
                completed && !isCurrent && "yd-wiz-progress-dot--done",
                locked && "yd-wiz-progress-dot--locked",
              ].filter(Boolean).join(" ")}
              disabled={!reachable}
              aria-current={isCurrent ? "step" : undefined}
              aria-disabled={!reachable}
              onClick={() => reachable && onStepClick(i)}
            >
              {locked ? <Lock size={12} strokeWidth={2.2} /> : completed && !isCurrent ? <Check size={13} strokeWidth={2.5} /> : i + 1}
            </button>
            <div className="yd-wiz-progress-label-wrap">
              <span className="yd-wiz-progress-label">{step.label}</span>
              {step.optional && <span className="yd-wiz-progress-optional">Optional</span>}
            </div>
            {i < steps.length - 1 && <span className="yd-wiz-progress-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
