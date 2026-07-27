"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthField } from "@/components/auth/AuthField";
import { AuthRoleSelector, type AuthAccountRole } from "@/components/auth/AuthRoleSelector";
import { AuthSelectField } from "@/components/auth/AuthSelectField";
import { AuthSplitLayout, REGISTER_HERO } from "@/components/auth/AuthSplitLayout";
import { useAuth } from "@/hooks/useAuth";
import { dashboardPathForRole } from "@/lib/dashboard-routes";
import {
	formatStudentProgram,
	getDepartmentLabel,
	NIGERIA_DEPARTMENT_GROUPS,
	NIGERIA_PROGRAM_LEVELS,
} from "@/lib/nigeria-departments";
import { getUniversityLabel, NIGERIA_UNIVERSITY_GROUPS } from "@/lib/nigeria-universities";
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
	const [institutionId, setInstitutionId] = useState("");
	const [departmentId, setDepartmentId] = useState("");
	const [programLevelId, setProgramLevelId] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [universities, setUniversities] = useState<OnboardedUniversity[] | null>(null);
	const [universitiesLoading, setUniversitiesLoading] = useState(true);

	useEffect(() => {
		if (!loading && user) router.replace(dashboardPathForRole(user.role));
	}, [loading, user, router]);

	useEffect(() => {
		const fromQuery = searchParams.get("role");
		if (fromQuery) setRole(parseRole(fromQuery));
	}, [searchParams]);

	useEffect(() => {
		let cancelled = false;
		setUniversitiesLoading(true);
		void fetchOnboardedUniversities()
			.then((list) => {
				if (!cancelled) setUniversities(list);
			})
			.catch(() => {
				// Fall back to static catalogue if the public endpoint is unavailable.
				if (!cancelled) setUniversities(null);
			})
			.finally(() => {
				if (!cancelled) setUniversitiesLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const isStudent = role === "student";
	const usingOnboardedList = universities !== null;
	const noOnboardedUniversities = usingOnboardedList && universities.length === 0;

	const institutionOptions = useMemo(() => {
		if (usingOnboardedList) {
			return universities.map((university) => ({
				id: university.catalogueId,
				label: university.name,
			}));
		}
		return NIGERIA_UNIVERSITY_GROUPS.flatMap((group) => group.universities);
	}, [universities, usingOnboardedList]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (universitiesLoading) {
			setError("Still loading institutions. Please wait a moment.");
			return;
		}

		if (noOnboardedUniversities) {
			setError(
				"Your university is not yet onboarded on this platform. Contact your administrator.",
			);
			return;
		}

		if (!institutionId) {
			setError("Please select your institution.");
			return;
		}

		if (usingOnboardedList && !universities.some((u) => u.catalogueId === institutionId)) {
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
		const selected = usingOnboardedList
			? universities.find((u) => u.catalogueId === institutionId)
			: null;
		const institution = selected?.name ?? getUniversityLabel(institutionId);

		setSubmitting(true);
		try {
			const payload = {
				name,
				email,
				password,
				department,
				institution,
				catalogueId: institutionId,
			};

			const registered = isStudent ? await registerStudent(payload) : await register(payload);
			router.push(dashboardPathForRole(registered.role));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

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
							id="register-institution"
							label="Institution"
							value={institutionId}
							onChange={(e) => setInstitutionId(e.target.value)}
							placeholder={
								universitiesLoading
									? "Loading institutions…"
									: noOnboardedUniversities
										? "No onboarded institutions yet"
										: "Select your university or polytechnic"
							}
							required
							disabled={submitting || universitiesLoading || noOnboardedUniversities}
						>
							{institutionOptions.map((university) => (
								<option key={university.id} value={university.id}>
									{university.label}
								</option>
							))}
						</AuthSelectField>

						{noOnboardedUniversities && (
							<p className="login-form-note" role="status">
								Your university is not yet onboarded on this platform. Contact your administrator.
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
					disabled={submitting || loading || universitiesLoading || noOnboardedUniversities}
				>
					{submitting
						? "Creating account…"
						: isStudent
							? "Create student account"
							: "Create lecturer account"}
				</button>

				<p className="login-form-note">
					By creating an account you agree to use {isStudent ? "student" : "lecturer"} tools within your
					institution&apos;s governed AI environment.
				</p>
			</form>
		</AuthSplitLayout>
	);
}
