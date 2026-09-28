"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminInput } from "@/components/admin/AdminInput";
import {
	AdminPanel,
	AdminStatCard,
	SuperAdminShell,
} from "@/components/admin/SuperAdminShell";
import { useSuperAdminGuard } from "@/hooks/useAdminGuard";
import {
	fetchAdminLegalDocuments,
	updateAdminLegalDocument,
	type AdminLegalDocumentRecord,
} from "@/lib/admin-api";
import type { LegalDocumentId } from "@/lib/legal-documents";

type DraftSection = {
	title: string;
	paragraphsText: string;
};

type Draft = {
	title: string;
	intro: string;
	sections: DraftSection[];
};

const TABS: { id: LegalDocumentId; label: string }[] = [
	{ id: "terms", label: "Terms of Service" },
	{ id: "privacy", label: "Privacy Policy" },
	{ id: "aup", label: "Acceptable Use" },
];

function toDraft(doc: AdminLegalDocumentRecord): Draft {
	return {
		title: doc.title,
		intro: doc.intro,
		sections: doc.sections.map((section) => ({
			title: section.title,
			paragraphsText: section.paragraphs.join("\n\n"),
		})),
	};
}

function fromDraft(draft: Draft): {
	title: string;
	intro: string;
	sections: { title: string; paragraphs: string[] }[];
} {
	return {
		title: draft.title,
		intro: draft.intro,
		sections: draft.sections.map((section) => ({
			title: section.title,
			paragraphs: section.paragraphsText
				.split(/\n\s*\n/)
				.map((p) => p.trim())
				.filter(Boolean),
		})),
	};
}

export function SuperAdminLegalDashboard() {
	const { ready } = useSuperAdminGuard();
	const [activeId, setActiveId] = useState<LegalDocumentId>("terms");
	const [documents, setDocuments] = useState<AdminLegalDocumentRecord[]>([]);
	const [accountPolicyVersion, setAccountPolicyVersion] = useState("1");
	const [draft, setDraft] = useState<Draft | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const load = useCallback(async (preferredId?: LegalDocumentId) => {
		setError(null);
		try {
			const data = await fetchAdminLegalDocuments();
			setDocuments(data.documents);
			setAccountPolicyVersion(data.accountPolicyVersion);
			const targetId = preferredId ?? activeId;
			const current =
				data.documents.find((d) => d.id === targetId) ?? data.documents[0] ?? null;
			if (current) {
				setActiveId(current.id);
				setDraft(toDraft(current));
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [activeId]);

	useEffect(() => {
		if (!ready) return;
		void load("terms");
		// eslint-disable-next-line react-hooks/exhaustive-deps -- load once when guard is ready
	}, [ready]);

	const selectTab = (id: LegalDocumentId) => {
		const doc = documents.find((d) => d.id === id);
		if (!doc) return;
		setActiveId(id);
		setDraft(toDraft(doc));
		setSuccess(null);
		setError(null);
	};

	const preview = useMemo(() => {
		if (!draft) return null;
		return fromDraft(draft);
	}, [draft]);

	const onSave = async () => {
		if (!draft) return;
		setSaving(true);
		setError(null);
		setSuccess(null);
		try {
			const result = await updateAdminLegalDocument(activeId, fromDraft(draft));
			setAccountPolicyVersion(result.accountPolicyVersion);
			setDocuments((prev) =>
				prev.map((doc) => (doc.id === result.document.id ? result.document : doc)),
			);
			setDraft(toDraft(result.document));
			setSuccess(
				`Published. Account policy version is now ${result.accountPolicyVersion}. Users will re-accept at next sign-in.`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const updateSection = (index: number, patch: Partial<DraftSection>) => {
		setDraft((prev) => {
			if (!prev) return prev;
			const sections = prev.sections.map((section, i) =>
				i === index ? { ...section, ...patch } : section,
			);
			return { ...prev, sections };
		});
	};

	const addSection = () => {
		setDraft((prev) =>
			prev
				? {
						...prev,
						sections: [...prev.sections, { title: "New section", paragraphsText: "" }],
					}
				: prev,
		);
	};

	const removeSection = (index: number) => {
		setDraft((prev) =>
			prev
				? { ...prev, sections: prev.sections.filter((_, i) => i !== index) }
				: prev,
		);
	};

	return (
		<SuperAdminShell
			title="Legal pages"
			subtitle="Edit Terms of Service, Privacy Policy, and Acceptable Use Policy"
			actions={
				<button
					type="button"
					className="primary-btn"
					onClick={() => void onSave()}
					disabled={saving || !draft}
				>
					{saving ? "Publishing…" : "Publish"}
				</button>
			}
		>
			{error && (
				<div className="banner banner-error" role="alert">
					{error}
				</div>
			)}
			{success && (
				<div className="banner banner-success" role="status">
					{success}
				</div>
			)}

			<section className="admin-stats">
				<AdminStatCard label="Policy version" value={accountPolicyVersion} />
				<AdminStatCard label="Documents" value={documents.length || 3} />
			</section>

			{loading && <p className="muted">Loading legal documents…</p>}

			{!loading && draft && (
				<>
					<div className="admin-legal-tabs" role="tablist" aria-label="Legal documents">
						{TABS.map((tab) => (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={activeId === tab.id}
								className={`admin-legal-tab${activeId === tab.id ? " admin-legal-tab-active" : ""}`}
								onClick={() => selectTab(tab.id)}
							>
								{tab.label}
							</button>
						))}
					</div>

					<AdminPanel title="Edit write-up">
						<div className="admin-legal-editor">
							<AdminInput
								label="Title"
								value={draft.title}
								onChange={(e) => setDraft({ ...draft, title: e.target.value })}
							/>
							<AdminInput
								label="Intro"
								multiline
								rows={4}
								value={draft.intro}
								onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
							/>

							{draft.sections.map((section, index) => (
								<div key={index} className="admin-legal-section-card">
									<div className="admin-legal-section-toolbar">
										<strong>Section {index + 1}</strong>
										<button
											type="button"
											className="ghost-btn"
											onClick={() => removeSection(index)}
											disabled={draft.sections.length <= 1}
										>
											Remove
										</button>
									</div>
									<AdminInput
										label="Section title"
										value={section.title}
										onChange={(e) => updateSection(index, { title: e.target.value })}
									/>
									<AdminInput
										label="Paragraphs"
										hint="Separate paragraphs with a blank line."
										multiline
										rows={6}
										value={section.paragraphsText}
										onChange={(e) =>
											updateSection(index, { paragraphsText: e.target.value })
										}
									/>
								</div>
							))}

							<button type="button" className="ghost-btn" onClick={addSection}>
								Add section
							</button>
						</div>
					</AdminPanel>

					{preview && (
						<AdminPanel title="Preview">
							<div className="admin-legal-preview">
								<h2 className="legal-page-title">{preview.title}</h2>
								<p className="legal-page-intro">{preview.intro}</p>
								{preview.sections.map((section, sectionIndex) => (
									<section key={`${section.title}-${sectionIndex}`} className="legal-page-section">
										<h3 className="legal-page-section-title">{section.title}</h3>
										{section.paragraphs.map((paragraph, paragraphIndex) => (
											<p
												key={`${sectionIndex}-${paragraphIndex}`}
												className="legal-page-paragraph"
											>
												{paragraph}
											</p>
										))}
									</section>
								))}
							</div>
						</AdminPanel>
					)}
				</>
			)}
		</SuperAdminShell>
	);
}
