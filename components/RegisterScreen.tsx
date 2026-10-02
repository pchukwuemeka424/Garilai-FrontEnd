"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthField } from "@/components/auth/AuthField";
import { AuthRoleSelector, type AuthAccountRole } from "@/components/auth/AuthRoleSelector";
import { AuthSearchableSelect } from "@/components/auth/AuthSearchableSelect";
import { AuthSelectField } from "@/components/auth/AuthSelectField";
import { AuthSplitLayout, REGISTER_HERO } from "@/components/auth/AuthSplitLayout";
import { LegalDocumentModal } from "@/components/legal/LegalDocumentModal";
import { useAuth } from "@/hooks/useAuth";
import { getRegisterCountry, REGISTER_COUNTRIES } from "@/lib/countries";
import { dashboardPathForRole } from "@/lib/dashboard-routes";
import type { LegalDocument } from "@/lib/legal-documents";
import {
	formatStudentProgram,
	getDepartmentLabel,
	NIGERIA_DEPARTMENT_GROUPS,
	NIGERIA_PROGRAM_LEVELS,
} from "@/lib/nigeria-departments";
import { isFreeEmail, LECTURER_FREE_EMAIL_ERROR } from "@/lib/email";
import { COURSE_YEAR_OPTIONS } from "@/lib/portal/course-years";
import {
	fetchOnboardedUniversities,
	type OnboardedUniversity,
} from "@/lib/universities-api";

type Props = {
	defaultRole?: AuthAccountRole;
};

type RegisterStep = "account" | "institution" | "security";

const STEPS: { id: RegisterStep; label: string }[] = [
	{ id: "account", label: "Account" },
	{ id: "institution", label: "Institution" },
	{ id: "security", label: "Security" },
];

function parseRole(value: string | null): AuthAccountRole {
	return value === "student" ? "student" : "lecturer";
}

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function RegisterScreen({ defaultRole = "lecturer" }: Props) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading, register, registerStudent } = useAuth();

	const [stepIndex, setStepIndex] = useState(0);
	const [role, setRole] = useState<AuthAccountRole>(() =>
		parseRole(searchParams.get("role") ?? defaultRole),
	);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [countryCode, setCountryCode] = useState("");
	const [institutionId, setInstitutionId] = useState("");
	const [departmentId, setDepartmentId] = useState("");
	const [programLevelId, setProgramLevelId] = useState("");
	const [yearLevel, setYearLevel] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [acceptedPolicies, setAcceptedPolicies] = useState(false);
	const [legalModal, setLegalModal] = useState<LegalDocument["id"] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [universities, setUniversities] = useState<OnboardedUniversity[]>([]);
	const [universitiesLoading, setUniversitiesLoading] = useState(false);
	const [universitiesError, setUniversitiesError] = useState<string | null>(null);

	const isStudent = role === "student";
	const selectedCountry = getRegisterCountry(countryCode);
	const noOnboardedUniversities = Boolean(countryCode) && !universitiesLoading && universities.length === 0;
	const currentStep = STEPS[stepIndex]?.id ?? "account";
	const isFirstStep = stepIndex === 0;
	const isLastStep = stepIndex === STEPS.length - 1;

	useEffect(() => {
		if (!loading && user) router.replace(dashboardPathForRole(user.role));
	}, [loading, user, router]);

	useEffect(() => {
		const fromQuery = searchParams.get("role");
		if (fromQuery) setRole(parseRole(fromQuery));
	}, [searchParams]);

	useEffect(() => {
		if (!countryCode) {
			setUniversities([]);
			setUniversitiesLoading(false);
			setUniversitiesError(null);
			setInstitutionId("");
			return;
		}

		let cancelled = false;
		setUniversitiesLoading(true);
		setUniversitiesError(null);
		setInstitutionId("");
		setUniversities([]);

		void fetchOnboardedUniversities(countryCode)
			.then((list) => {
				if (!cancelled) setUniversities(list);
			})
			.catch((err) => {
				if (!cancelled) {
					setUniversities([]);
					setUniversitiesError(
						err instanceof Error ? err.message : "Could not load institutions.",
					);
				}
			})
			.finally(() => {
				if (!cancelled) setUniversitiesLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [countryCode]);

	const institutionOptions = useMemo(
		() =>
			universities.map((university) => ({
				value: university.catalogueId,
				label: university.name,
			})),
		[universities],
	);

	const validateStep = (step: RegisterStep): string | null => {
		if (step === "account") {
			if (role !== "student" && role !== "lecturer") {
				return "Please select an account type.";
			}
			if (!name.trim()) return "Please enter your full name.";
			if (!email.trim()) return "Please enter your email.";
			if (!isValidEmail(email)) return "Please enter a valid email address.";
			if (!isStudent && isFreeEmail(email)) return LECTURER_FREE_EMAIL_ERROR;
			return null;
		}

		if (step === "institution") {
			if (!countryCode) return "Please select your country.";
			if (universitiesLoading) return "Still loading institutions. Please wait a moment.";
			if (universitiesError) return universitiesError;
			if (noOnboardedUniversities) {
				return "No onboarded universities for this country yet. Contact your administrator.";
			}
			if (!institutionId) return "Please select your institution.";
			if (!universities.some((u) => u.catalogueId === institutionId)) {
				return "Your university is not yet onboarded on this platform. Contact your administrator.";
			}
			if (!departmentId) return "Please select your department.";
			if (isStudent && !programLevelId) return "Please select your program.";
			if (isStudent && !yearLevel) return "Please select your year / level.";
			return null;
		}

		if (step === "security") {
			if (password.length < 8) return "Password must be at least 8 characters.";
			if (password !== confirmPassword) return "Passwords do not match.";
			if (!acceptedPolicies) {
				return "Please agree to the Terms of Service, Privacy Policy, and Acceptable Use Policy.";
			}
			return null;
		}

		return null;
	};

	const goToStep = (index: number) => {
		setError(null);
		setStepIndex(Math.max(0, Math.min(STEPS.length - 1, index)));
	};

	const handleNext = () => {
		const message = validateStep(currentStep);
		if (message) {
			setError(message);
			return;
		}
		goToStep(stepIndex + 1);
	};

	const handlePrevious = () => {
		goToStep(stepIndex - 1);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isLastStep) {
			handleNext();
			return;
		}

		setError(null);
		for (const step of STEPS) {
			const message = validateStep(step.id);
			if (message) {
				setError(message);
				setStepIndex(STEPS.findIndex((s) => s.id === step.id));
				return;
			}
		}

		const department = isStudent
			? formatStudentProgram(departmentId, programLevelId, yearLevel)
			: getDepartmentLabel(departmentId);
		const institution =
			universities.find((u) => u.catalogueId === institutionId)?.name ?? institutionId;

		setSubmitting(true);
		try {
			const payload = {
				name,
				email,
				password,
				department,
				institution,
				catalogueId: institutionId,
				country: countryCode,
				acceptedPolicies: true as const,
			};

			const registered = isStudent ? await registerStudent(payload) : await register(payload);
			router.push(dashboardPathForRole(registered.role));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const institutionPlaceholder = !countryCode
		? "Select a country first"
		: universitiesLoading
			? "Loading institutions…"
			: noOnboardedUniversities
				? "No onboarded institutions for this country"
				: universitiesError
					? "Could not load institutions"
					: selectedCountry
						? `Select your institution in ${selectedCountry.label}`
						: "Select your university or polytechnic";

	const stepTitle =
		currentStep === "account"
			? "Account details"
			: currentStep === "institution"
				? "Institution"
				: "Secure your account";

	const stepHint =
		currentStep === "account"
			? "Choose your role and tell us how to identify your account."
			: currentStep === "institution"
				? "Link your profile to an onboarded university."
				: "Create a password and accept the policies to finish.";

	return (
		<AuthSplitLayout
			wide
			hero={REGISTER_HERO}
			title="Create your account"
			subtitle="Set up your institutional profile in a few short steps."
			footer={
				<p>
					Already have an account?{" "}
					<Link href="/login" className="login-link">
						Sign in
					</Link>
				</p>
			}
		>
			<form className="login-form" onSubmit={handleSubmit} noValidate>
				<nav className="login-stepper" aria-label="Registration steps">
					<ol className="login-stepper-list">
						{STEPS.map((step, index) => {
							const status =
								index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming";
							return (
								<li
									key={step.id}
									className={`login-stepper-item login-stepper-item-${status}`}
									aria-current={status === "current" ? "step" : undefined}
								>
									<span className="login-stepper-index" aria-hidden="true">
										{index < stepIndex ? "✓" : index + 1}
									</span>
									<span className="login-stepper-label">{step.label}</span>
								</li>
							);
						})}
					</ol>
					<p className="login-stepper-progress">
						Step {stepIndex + 1} of {STEPS.length}
					</p>
				</nav>

				<section className="login-form-section" aria-labelledby="register-step-title">
					<div className="login-step-intro">
						<h2 id="register-step-title" className="login-form-section-title">
							{stepTitle}
						</h2>
						<p className="login-step-hint">{stepHint}</p>
					</div>

					{currentStep === "account" && (
						<div className="login-form-fields">
							<div className="login-form-field-block">
								<span className="login-form-field-label">Account type</span>
								<AuthRoleSelector
									value={role}
									onChange={(next) => {
										setRole(next);
										setError(null);
									}}
									disabled={submitting}
								/>
							</div>

							<div className="login-form-fields-grid">
								<AuthField
									id="register-name"
									label="Full name"
									placeholder={isStudent ? "Alex Johnson" : "Dr. Jane Smith"}
									value={name}
									onChange={(e) => setName(e.target.value)}
									autoComplete="name"
									required
								/>

								<AuthField
									id="register-email"
									label="Email"
									type="email"
									placeholder={
										isStudent
											? "alex.johnson@gmail.com"
											: "jane.smith@university.edu"
									}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									autoComplete="email"
									required
									error={
										!isStudent && email.trim() && isFreeEmail(email)
											? "University or professional email required"
											: undefined
									}
								/>
							</div>
						</div>
					)}

					{currentStep === "institution" && (
						<div className="login-form-fields">
							<AuthSelectField
								id="register-country"
								label="Country"
								value={countryCode}
								onChange={(e) => setCountryCode(e.target.value)}
								placeholder="Select your country"
								required
								disabled={submitting}
							>
								{REGISTER_COUNTRIES.map((country) => (
									<option key={country.code} value={country.code}>
										{country.label}
									</option>
								))}
							</AuthSelectField>

							<AuthSearchableSelect
								id="register-institution"
								label="Institution"
								value={institutionId}
								onChange={setInstitutionId}
								placeholder={institutionPlaceholder}
								searchPlaceholder="Search institutions…"
								resetKey={countryCode}
								required
								disabled={
									submitting ||
									!countryCode ||
									universitiesLoading ||
									noOnboardedUniversities ||
									Boolean(universitiesError) ||
									institutionOptions.length === 0
								}
								options={institutionOptions}
							/>

							{noOnboardedUniversities && (
								<p className="login-form-note" role="status">
									No universities are onboarded for {selectedCountry?.label ?? "this country"} yet.
									Contact your administrator.
								</p>
							)}

							{universitiesError && (
								<p className="login-form-note" role="alert">
									{universitiesError}
								</p>
							)}

							<AuthSelectField
								id="register-department"
								label="Department / faculty"
								value={departmentId}
								onChange={(e) => setDepartmentId(e.target.value)}
								placeholder="Select department"
								required
							>
								{NIGERIA_DEPARTMENT_GROUPS.map((group) => (
									<optgroup key={group.id} label={group.label}>
										{group.departments.map((department) => (
											<option key={department.id} value={department.id}>
												{department.label}
											</option>
										))}
									</optgroup>
								))}
							</AuthSelectField>

							{isStudent && (
								<div className="login-form-fields-grid">
									<AuthSelectField
										id="register-program"
										label="Program"
										value={programLevelId}
										onChange={(e) => setProgramLevelId(e.target.value)}
										placeholder="Select program"
										required
									>
										{NIGERIA_PROGRAM_LEVELS.map((level) => (
											<option key={level.id} value={level.id}>
												{level.label}
											</option>
										))}
									</AuthSelectField>

									<AuthSelectField
										id="register-year-level"
										label="Year / level"
										value={yearLevel}
										onChange={(e) => setYearLevel(e.target.value)}
										placeholder="Select year / level"
										required
									>
										{COURSE_YEAR_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</AuthSelectField>
								</div>
							)}
						</div>
					)}

					{currentStep === "security" && (
						<div className="login-form-fields">
							<div className="login-form-fields-grid">
								<AuthField
									id="register-password"
									label="Password"
									type="password"
									placeholder="At least 8 characters"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									autoComplete="new-password"
									minLength={8}
									required
								/>

								<AuthField
									id="register-confirm"
									label="Confirm password"
									type="password"
									placeholder="Re-enter password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									autoComplete="new-password"
									minLength={8}
									required
								/>
							</div>

							<label className="login-consent">
								<input
									type="checkbox"
									checked={acceptedPolicies}
									onChange={(e) => setAcceptedPolicies(e.target.checked)}
									disabled={submitting}
									required
								/>
								<span>
									I agree to the{" "}
									<button
										type="button"
										className="login-link login-link-button"
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setLegalModal("terms");
										}}
									>
										Terms of Service
									</button>
									,{" "}
									<button
										type="button"
										className="login-link login-link-button"
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setLegalModal("privacy");
										}}
									>
										Privacy Policy
									</button>
									, and{" "}
									<button
										type="button"
										className="login-link login-link-button"
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setLegalModal("aup");
										}}
									>
										Acceptable Use Policy
									</button>
									.
								</span>
							</label>
						</div>
					)}
				</section>

				{error && (
					<div className="login-alert login-alert-error" role="alert">
						{error}
					</div>
				)}

				<div className={`login-step-actions${isFirstStep ? " login-step-actions-single" : ""}`}>
					{!isFirstStep ? (
						<button
							type="button"
							className="login-btn login-btn-secondary"
							onClick={handlePrevious}
							disabled={submitting}
						>
							Previous
						</button>
					) : null}

					{isLastStep ? (
						<button
							type="submit"
							className="login-btn"
							disabled={submitting || loading || !acceptedPolicies}
						>
							{submitting
								? "Creating account…"
								: isStudent
									? "Create student account"
									: "Create lecturer account"}
						</button>
					) : (
						<button
							type="button"
							className="login-btn"
							onClick={handleNext}
							disabled={
								submitting ||
								(currentStep === "institution" &&
									(universitiesLoading ||
										noOnboardedUniversities ||
										Boolean(universitiesError)))
							}
						>
							Next
						</button>
					)}
				</div>

				{isLastStep && (
					<p className="login-form-note">
						You will use {isStudent ? "student" : "lecturer"} tools within your institution&apos;s
						governed AI environment.
					</p>
				)}
			</form>

			<LegalDocumentModal documentId={legalModal} onClose={() => setLegalModal(null)} />
		</AuthSplitLayout>
	);
}
