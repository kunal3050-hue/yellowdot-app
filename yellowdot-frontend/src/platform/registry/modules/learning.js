/**
 * learning.js — Module Registry: academics and the child's developmental record
 * PLATFORM ARCHITECTURE §5
 *
 * Academics is deliberately FIVE modules, not one, because each screen carries
 * its own routeKey in permissions.js and its own row in the Roles UI. Collapsing
 * them into one entry would silently widen access.
 */
import { defineModule } from "../defineModule.js";

export const academicsClassesModule = defineModule({
  id: "academics_classes",
  label: "Classes",
  icon: "BookOpen",
  category: "academics",
  capability: "classes_batches.view",
  actions: ["view"],
  keywords: ["class", "classes", "section", "academic structure"],
  // C4, Care experience review (2026-07-31): removed by explicit decision,
  // same reasoning as studentsModule in people.js — a browse/reference
  // screen, not a work-queue destination. Stays reachable via the sidebar.
  routes: [
    {
      path: "/academics/classes", routeKey: "academics-classes", label: "Classes", icon: "BookOpen",
      nav: [{ category: "academics", order: 10 }],
      grid: { section: "academics", label: "Classes", icon: "BookOpen",
              description: "Set up class sections and academic structure." },
    },
  ],
});

export const academicsBatchesModule = defineModule({
  id: "academics_batches",
  label: "Batches",
  icon: "Layers",
  category: "academics",
  capability: "classes_batches.view",
  actions: ["view"],
  keywords: ["batch", "batches", "timing", "group"],
  routes: [
    {
      path: "/academics/batches", routeKey: "academics-batches", label: "Batches", icon: "Layers",
      nav: [{ category: "academics", order: 20 }],
      grid: { section: "academics", label: "Batches", icon: "Layers",
              description: "Organise batch timings and groupings." },
    },
  ],
});

export const academicsTeacherAllocationModule = defineModule({
  id: "academics_teacher_allocation",
  label: "Teacher Allocation",
  icon: "Briefcase",
  category: "academics",
  capability: "classes_batches.view",
  actions: ["view"],
  keywords: ["teacher", "allocation", "assign teacher", "class teacher"],
  routes: [
    {
      path: "/academics/teacher-allocation", routeKey: "academics-teacher-allocation",
      label: "Teacher Allocation", icon: "Briefcase",
      nav: [{ category: "academics", order: 30 }],
      grid: { section: "academics", label: "Teacher Allocation", icon: "GraduationCap",
              description: "Assign teachers to the classes they lead." },
    },
  ],
});

export const academicsClassroomAllocationModule = defineModule({
  id: "academics_classroom_allocation",
  label: "Classroom Allocation",
  icon: "Grid",
  category: "academics",
  capability: "classes_batches.view",
  actions: ["view"],
  keywords: ["classroom", "room", "allocation", "space"],
  routes: [
    {
      path: "/academics/classroom-allocation", routeKey: "academics-classroom-allocation",
      label: "Classroom Allocation", icon: "Grid",
      nav: [{ category: "academics", order: 40 }],
      grid: { section: "academics", label: "Classroom Allocation", icon: "School",
              description: "Assign physical rooms to classes and batches." },
    },
  ],
});

export const academicsStudentAllocationModule = defineModule({
  id: "academics_student_allocation",
  label: "Student Enrollment",
  icon: "UserCheck",
  category: "academics",
  capability: "student_enrollment.view",
  actions: ["view"],
  keywords: ["enrollment", "enrolment", "student allocation", "placement"],
  routes: [
    {
      path: "/academics/student-allocation", routeKey: "academics-student-allocation",
      label: "Student Enrollment", icon: "UserCheck",
      nav: [{ category: "academics", order: 50 }],
      grid: { section: "admissions", label: "Student Allocation", icon: "ListChecks",
              description: "Place admitted students into their class and batch." },
    },
  ],
});

/**
 * Child Journey. Three rbacConfig permission modules (observations,
 * journey_media, artwork) all map to the single "child-journey" routeKey;
 * `observations.view` is the baseline gate for reaching the module at all.
 */
export const childJourneyModule = defineModule({
  id: "child_journey",
  label: "Child Journey",
  icon: "BookOpen",
  category: "child_journey",
  capability: "observations.view",
  featureFlag: "CHILD_JOURNEY",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["journey", "milestone", "observation", "artwork", "memories", "portfolio"],
  surfaces: { care: { order: 30, roles: { teacher: 30 } } },
  routes: [
    {
      path: "/child-journey", routeKey: "child-journey", label: "Child Journey", icon: "BookOpen",
      nav: [{ category: "child_journey", order: 10, matchPaths: ["/child-journey/"] }],
      grid: { section: "students", label: "Child Journey", icon: "Sparkles",
              description: "Milestones, artwork and memories for every child." },
    },
    { path: "/child-journey/observe",   routeKey: "child-journey", capability: "observations.create" },
    { path: "/child-journey/artwork",   routeKey: "child-journey", capability: "artwork.create" },
    { path: "/child-journey/milestone", routeKey: "child-journey", capability: "observations.create" },
  ],
});

export default [
  academicsClassesModule, academicsBatchesModule, academicsTeacherAllocationModule,
  academicsClassroomAllocationModule, academicsStudentAllocationModule, childJourneyModule,
];
