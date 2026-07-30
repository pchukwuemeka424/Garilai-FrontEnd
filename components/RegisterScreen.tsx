"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthField } from "@/components/auth/AuthField";
import { AuthRoleSelector, type AuthAccountRole } from "@/components/auth/AuthRoleSelector";
import { AuthSelectField } from "@/components/auth/AuthSelectField";
import { AuthSplitLayout, REGISTER_HERO } from "@/components/auth/AuthSplitLayout";
import { useAuth } from "@/hooks/useAuth";
import { getRegisterCountry, REGISTER_COUNTRIES } from "@/lib/countries";
import { dashboardPathForRole } from "@/lib/dashboard-routes";
import {
	formatStudentProgram,
	getDepartmentLabel,
	NIGERIA_DEPARTMENT_GROUPS,
	NIGERIA_PROGRAM_LEVELS,
} from "@/lib/nigeria-departments";
import {
	fetchOnboardedUniversities,
	type OnboardedUniversity,
} from "@/lib/universities-api";

type Props = {
	defaultRole?: AuthAccountRole;
};

function parseRole(value: string | null): AuthAccountRole {
	return value === "student" ? "student" : "lecturer";
}

export function RegisterScreen({ defaultRole = "lecturer" }: Props) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading, register, registerStudent } = useAuth();

	const [role, setRole] = useState<AuthAccountRole>(() =>
		parseRole(searchParams.get("role") ?? defaultRole),
	);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [countryCode, setCountryCode] = useState("");
	const [institutionId, setInstitutionId] = useState("");
	const [departmentId, setDepartmentId] = useState("");
	const [programLevelId, setProgramLevelId] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [universities, setUniversities] = useState<OnboardedUniversity[]>([]);
	const [universitiesLoading, setUniversitiesLoading] = useState(false);
	const [universitiesError, setUniversitiesError] = useState<string | null>(null);

	const isStudent = role === "student";
	const selectedCountry = getRegisterCountry(countryCode);
	const noOnboardedUniversities = Boolean(countryCode) && !universitiesLoading && universities.length === 0;

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
				id: university.catalogueId,
				label: university.name,
			})),
		[universities],
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!countryCode) {
			setError("Please select your country.");
			return;
		}

		if (universitiesLoading) {
			setError("Still loading institutions. Please wait a moment.");
			return;
		}

		if (universitiesError) {
			setError(universitiesError);
			return;
		}

		if (noOnboardedUniversities) {
			setError(
				"No onboarded universities for this country yet. Contact your administrator.",
			);
			return;
		}

		if (!institutionId) {
			setError("Please select your institution.");
			return;
		}

		if (!universities.some((u) => u.catalogueId === institutionId)) {
			setError(
				"Your university is not yet onboarded on this platform. Contact your administrator.",
			);
			return;
		}

		if (!departmentId) {
			setError("Please select your department.");
			return;
		}

		if (isStudent && !programLevelId) {
			setError("Please select your program level.");
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}

		const department = isStudent
			? formatStudentProgram(departmentId, programLevelId)
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

	return (
		<AuthSplitLayout
			wide
			hero={REGISTER_HERO}
			title="Create your account"
			subtitle="Set up your profile in a few steps. We'll tailor your workspace to your role and institution."
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
				<section className="login-form-section">
					<h2 className="login-form-section-title">Account type</h2>
					<AuthRoleSelector value={role} onChange={setRole} disabled={submitting} />
				</section>

				<section className="login-form-section">
					<h2 className="login-form-section-title">Personal details</h2>
					<div className="login-form-fields login-form-fields-grid">
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
							placeholder={isStudent ? "alex.johnson@gmail.com" : "jane.smith@gmail.com"}
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							autoComplete="email"
							required
						/>
					</div>
				</section>

				<section className="login-form-section">
					<h2 className="login-form-section-title">Institution</h2>
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

						<AuthSelectField
							id="register-institution"
							label="Institution"
							value={institutionId}
							onChange={(e) => setInstitutionId(e.target.value)}
							placeholder={institutionPlaceholder}
							required
							disabled={
								submitting ||
								!countryCode ||
								universitiesLoading ||
								noOnboardedUniversities ||
								Boolean(universitiesError) ||
								institutionOptions.length === 0
							}
						>
							{institutionOptions.map((university) => (
								<option key={university.id} value={university.id}>
									{university.label}
								</option>
							))}
						</AuthSelectField>

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

						<div className={isStudent ? "login-form-fields-grid" : undefined}>
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
								<AuthSelectField
									id="register-program"
									label="Program / level"
									value={programLevelId}
									onChange={(e) => setProgramLevelId(e.target.value)}
									placeholder="Select program level"
									required
								>
									{NIGERIA_PROGRAM_LEVELS.map((level) => (
										<option key={level.id} value={level.id}>
											{level.label}
										</option>
									))}
								</AuthSelectField>
							)}
						</div>
					</div>
				</section>

				<section className="login-form-section">
					<h2 className="login-form-section-title">Security</h2>
					<div className="login-form-fields login-form-fields-grid">
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
				</section>

				{error && (
					<div className="login-alert login-alert-error" role="alert">
						{error}
					</div>
				)}

				<button
					type="submit"
					className="login-btn"
					disabled={
						submitting ||
						loading ||
						universitiesLoading ||
						noOnboardedUniversities ||
						!countryCode ||
						Boolean(universitiesError)
					}
				>
					{submitting
						? "Creating account…"
						: isStudent
							? "Create student account"
							: "Create lecturer account"}
				</button>

				<p className="login-form-note">
					By creating an account you agree to use {isStudent ? "student" : "lecturer"} tools within
					your institution&apos;s governed AI environment.
				</p>
			</form>
		</AuthSplitLayout>
	);
}
