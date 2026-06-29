# Munch V1 Release Manifest & Checklist

This document tracks the release checks and verification criteria for **Munch V1**. All baseline criteria have been successfully confirmed.

---

## 1. Functional Release Checks
- [x] **Mascot Dialog Flow**: Tested message submission cycle, transition to exploring states, and decision-path selection.
- [x] **Continuous Sessions**: Verified active companion configurations restore from localStorage correctly on layout resumes.
- [x] **Zero Cognitive Changes**: Confirmed zero modifications to database schemas or story consolidation managers.
- [x] **No Technical Leaks**: Internal pipeline matrices and LLM prompt tokens are completely stripped from client-bound payloads.

---

## 2. Visual & Spacing Audit
- [x] **Viewport Safety**: Zero horizontal scrollbars or page content clipping down to $320\text{px}$ viewports.
- [x] **Keyboard Safety**: Composer inputs adjust bottom heights dynamically on mobile devices.
- [x] **Design Registry**: Unified under `surface-system.ts` and `motion-system.ts`.

---

## 3. Technical Verification
- [x] **Security Middleware**: Authenticated Supabase routers block unverified routes.
- [x] **Unit Testing**: All 237 test suites pass synchronously.
- [x] **Production Compilation**: Tested production bundling via standard packaging builds.
- [x] **Error Handling**: Standard dashboard error boundaries implemented.
