/**
 * WizardStep — animates the transition between step content.
 */
import { motion } from "framer-motion";
import { wizardStepVariants, usePrefersReducedMotion, withReducedMotion } from "../motion";

export default function WizardStep({ stepKey, direction, children }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      key={stepKey}
      variants={withReducedMotion(wizardStepVariants(direction), reduced)}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="yd-wiz-step"
    >
      {children}
    </motion.div>
  );
}
