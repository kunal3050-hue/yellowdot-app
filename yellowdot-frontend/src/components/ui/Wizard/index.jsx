/**
 * Wizard — canonical KUE BOXS Design System multi-step flow component
 * ═══════════════════════════════════════════════════════════════════════
 * Use for: Admissions, Employee onboarding, Parent registration, School
 * setup, Subscription setup, Incident reporting.
 *
 * @prop {Array} steps   [{
 *   key, label, optional?, locked?, fields?: string[] (RHF field names validated on Next),
 *   render: (form: UseFormReturn) => ReactNode
 * }]
 * @prop {object} defaultValues     react-hook-form defaultValues
 * @prop {ZodSchema} schema         optional zod schema for the whole form (validated via trigger per-step)
 * @prop {string} orientation       "horizontal" | "vertical" (default: "horizontal"; collapses to compact on mobile via CSS)
 * @prop {string} autosaveKey       localStorage key; enables autosave + draft recovery when provided
 * @prop {function} onComplete     (values) => void | Promise — called on final step submit
 * @prop {function} onStepChange   (index, key) => void
 * @prop {object} successState     { icon, title, description, action: {label, onClick} }
 */
import { useMemo, useRef, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Button from "../Button";
import WizardProgress from "./WizardProgress";
import WizardStep from "./WizardStep";
import useAutosaveDraft from "./useAutosaveDraft";
import { cardVariants, usePrefersReducedMotion, withReducedMotion } from "../motion";

export default function Wizard({
  steps = [],
  defaultValues = {},
  schema,
  orientation = "horizontal",
  autosaveKey,
  onComplete,
  onStepChange,
  successState,
  className = "",
}) {
  const reduced = usePrefersReducedMotion();
  const form = useForm({
    defaultValues,
    resolver: schema ? zodResolver(schema) : undefined,
    mode: "onBlur",
  });
  const { watch, trigger, handleSubmit, reset } = form;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const draftBannerDismissed = useRef(false);

  const values = watch();
  const { draft, clearDraft } = useAutosaveDraft(autosaveKey, values, { paused: succeeded });
  const [showDraftBanner, setShowDraftBanner] = useState(!!draft && !!autosaveKey);

  const step = steps[currentIndex];
  const isLastStep = currentIndex === steps.length - 1;

  function goTo(index) {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    setFurthestIndex(f => Math.max(f, index));
    onStepChange?.(index, steps[index]?.key);
  }

  async function handleNext() {
    if (step.fields?.length) {
      const valid = await trigger(step.fields);
      if (!valid) return;
    }
    if (isLastStep) {
      setSubmitting(true);
      try {
        await handleSubmit(async (vals) => {
          await onComplete?.(vals);
          clearDraft();
          setSucceeded(true);
        })();
      } finally {
        setSubmitting(false);
      }
    } else {
      goTo(currentIndex + 1);
    }
  }

  function handleBack() {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }

  function handleResumeDraft() {
    reset(draft);
    setShowDraftBanner(false);
  }

  function handleDiscardDraft() {
    clearDraft();
    setShowDraftBanner(false);
  }

  const progressPct = Math.round(((currentIndex + 1) / steps.length) * 100);

  if (succeeded && successState) {
    return (
      <motion.div
        className={`yd-wiz-success ${className}`}
        variants={withReducedMotion(cardVariants, reduced)}
        initial="hidden"
        animate="visible"
      >
        <div className="yd-wiz-success-icon">
          {successState.icon || <Check size={28} strokeWidth={2.5} />}
        </div>
        <div className="yd-wiz-success-title">{successState.title || "All done!"}</div>
        {successState.description && <div className="yd-wiz-success-desc">{successState.description}</div>}
        {successState.action && (
          <Button variant="primary" onClick={successState.action.onClick} className="yd-wiz-success-action">
            {successState.action.label}
          </Button>
        )}
      </motion.div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className={`yd-wiz-root yd-wiz-root--${orientation} ${className}`}>
        {showDraftBanner && (
          <div className="yd-wiz-draft-banner">
            <span>You have a saved draft from an earlier session.</span>
            <div className="yd-wiz-draft-actions">
              <Button size="xs" variant="primary" onClick={handleResumeDraft}>Resume draft</Button>
              <Button size="xs" variant="outline" onClick={handleDiscardDraft}>Start over</Button>
            </div>
          </div>
        )}

        <div className="yd-wiz-mobile-bar">
          <span>Step {currentIndex + 1} of {steps.length}: {step.label}</span>
          <div className="yd-wiz-mobile-track"><div className="yd-wiz-mobile-fill" style={{ width: `${progressPct}%` }} /></div>
        </div>

        <div className="yd-wiz-body">
          <WizardProgress
            steps={steps}
            currentIndex={currentIndex}
            furthestIndex={furthestIndex}
            orientation={orientation}
            onStepClick={goTo}
          />

          <div className="yd-wiz-content">
            <WizardStep key={step.key} stepKey={step.key} direction={direction}>
              {step.render(form)}
            </WizardStep>

            <div className="yd-wiz-nav">
              <Button variant="outline" onClick={handleBack} disabled={currentIndex === 0 || submitting}>
                Back
              </Button>
              <Button variant="primary" onClick={handleNext} loading={submitting}>
                {isLastStep ? "Submit" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
