"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { createAdminPolicy, deleteAdminPolicy, evaluateAdminPolicy, fetchAdminPolicies, updateAdminPolicy } from "@/lib/admin-api";
import type { GovernancePolicyRecord, PolicyEvaluation, PolicyStats } from "@/lib/admin-governance";

const SCOPES = ["feature", "dataset", "tool", "use_case", "content"] as const;
const EFFECTS = ["permitted", "restricted", "blocked"] as const;

const ALL_ROLES = [
	"lecturer", "researcher", "student", "governance_admin",
	"faculty_admin", "department_admin", "compliance_officer",
	"data_protection_officer", "research_integrity_officer", "auditor",
];

const emptyForm = {
	name: "",
	description: "",
	scope: "feature" as string,
	target: "",
	effect: "blocked" as string,
	roles: [] as string[],
	faculties: [] as string[],
	enabled: true,
	priority: 100,
};

function exportPoliciesCsv(policies: GovernancePolicyRecord[]) {
	const headers = ["ID", "Name", "Scope", "Target", "Effect", "Roles", "Faculties", "Enabled", "Priority", "Created"];
	const rows = policies.map((p) => [
		p.id, p.name, p.scope, p.target, p.effect,
		p.roles.join("; "), p.faculties.join("; "),
		p.enabled ? "Yes" : "No", String(p.priority), p.createdAt,
	]);
	const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `garil-policies-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function AdminPoliciesDashboard() {
	const { ready } = useAdminGuard();
	const [policies, setPolicies] = useState<GovernancePolicyRecord[]>([]);
	const [stats, setStats] = useState<PolicyStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [scopeFilter, setScopeFilter] = useState("");
	const [effectFilter, setEffectFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [showTest, setShowTest] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [editingId, setEditingId] = useState<string | null>(null);

	const [testInput, setTestInput] = useState({ scope: "feature", target: "", role: "student", faculty: "" });
	const [testResult, setTestResult] = useState<PolicyEvaluation | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminPolicies();
			setPolicies(data.policies);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return policies.filter((p) => {
			if (scopeFilter && p.scope !== scopeFilter) return false;
			if (effectFilter && p.effect !== effectFilter) return false;
			if (q && !p.name.toLowerCase().includes(q) && !p.target.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
			return true;
		});
	}, [policies, search, scopeFilter, effectFilter]);

	const conflicts = useMemo(() => {
		const targetGroups: Record<string, GovernancePolicyRecord[]> = {};
		for (const p of policies.filter((p) => p.enabled)) {
			const key = `${p.scope}:${p.target}`;
			if (!targetGroups[key]) targetGroups[key] = [];
			targetGroups[key].push(p);
		}
		return Object.entries(targetGroups)
			.filter(([, group]) => {
				const effects = new Set(group.map((p) => p.effect));
				return effects.size > 1;
			})
			.map(([key, group]) => ({ key, policies: group }));
	}, [policies]);

	const onCreate = async () => {
		if (!form.name.trim() || !form.target.trim()) {
			setError("Name and target are required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			if (editingId) {
				await updateAdminPolicy(editingId, {
					name: form.name,
					description: form.description,
					scope: form.scope,
					target: form.target,
					effect: form.effect,
					roles: form.roles,
					faculties: form.faculties,
					enabled: form.enabled,
					priority: form.priority,
				});
			} else {
				await createAdminPolicy({
					name: form.name,
					description: form.description || undefined,
					scope: form.scope,
					target: form.target,
					effect: form.effect,
					roles: form.roles.length ? form.roles : undefined,
					faculties: form.faculties.length ? form.faculties : undefined,
					enabled: form.enabled,
					priority: form.priority,
				});
			}
			setForm(emptyForm);
			setEditingId(null);
			setShowCreate(false);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onEdit = (p: GovernancePolicyRecord) => {
		setForm({
			name: p.name,
			description: p.description,
			scope: p.scope,
			target: p.target,
			effect: p.effect,
			roles: p.roles,
			faculties: p.faculties,
			enabled: p.enabled,
			priority: p.priority,
		});
		setEditingId(p.id);
		setShowCreate(true);
	};

	const onToggle = async (p: GovernancePolicyRecord) => {
		setWorking(true);
		try {
			await updateAdminPolicy(p.id, { enabled: !p.enabled });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onDelete = async (p: GovernancePolicyRecord) => {
		if (!window.confirm(`Delete policy "${p.name}"?`)) return;
		setWorking(true);
		try {
			await deleteAdminPolicy(p.id);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onTest = async () => {
		if (!testInput.target.trim()) { setError("Target is required for testing."); return; }
		setWorking(true);
		setError(null);
		try {
			const result = await evaluateAdminPolicy({
				scope: testInput.scope,
				target: testInput.target,
				role: testInput.role,
				faculty: testInput.faculty || undefined,
			});
			setTestResult(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const toggleRole = (role: string) => {
		setForm((f) => ({
			...f,
			roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
		}));
	};

	return (
		<AdminShell
			title="Policy Management"
			subtitle="Institutional AI policies that define acceptable use and trigger alerts when violated"
			breadcrumb="Admin · Controls"
			actions={
				<div className="admin-actions-row">
					<button type="button" className="ghost-btn" onClick={() => { setShowCreate(!showCreate); setEditingId(null); setForm(emptyForm); }}>
						{showCreate ? "Cancel" : "Create Policy"}
					</button>
					<button type="button" className="ghost-btn" onClick={() => setShowTest(!showTest)}>
						{showTest ? "Hide Tester" : "Test Policy"}
					</button>
					<button type="button" className="ghost-btn" onClick={() => exportPoliciesCsv(filtered)}>Export</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>Refresh</button>
				</div>
			}
		>
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Total" value={stats.total} />
					<AdminStatCard label="Permitted" value={stats.permitted} accent="success" />
					<AdminStatCard label="Restricted" value={stats.restricted} accent="warning" />
					<AdminStatCard label="Blocked" value={stats.blocked} accent="danger" />
					<AdminStatCard label="Disabled" value={stats.disabled} />
					<AdminStatCard label="Conflicts" value={conflicts.length} accent={conflicts.length > 0 ? "danger" : "success"} hint="Same target, different effects" />
				</section>
			)}

			{showCreate && (
				<AdminPanel title={editingId ? "Edit Policy" : "Create Policy"} description="Define scope, target, effect, and applicable roles">
					<div className="admin-form-grid">
						<label>Name *<input className="topic-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Block bulk export for students" /></label>
						<label>Scope<select className="topic-input" value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>{SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
						<label>Target *<input className="topic-input" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="e.g. bulk_export, sensitive_data, gpt4" /></label>
						<label>Effect<select className="topic-input" value={form.effect} onChange={(e) => setForm((f) => ({ ...f, effect: e.target.value }))}>{EFFECTS.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
						<label>Priority<input className="topic-input" type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} /></label>
						<label className="admin-checkbox-label"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Enabled</label>
						<label className="admin-form-span">Description<textarea className="topic-input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
						<label className="admin-form-span">Faculties (comma-separated)<input className="topic-input" value={form.faculties.join(", ")} onChange={(e) => setForm((f) => ({ ...f, faculties: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))} placeholder="Leave empty for all" /></label>
						<div className="admin-form-span">
							<p className="field-label">Applicable Roles (select multiple)</p>
							<div className="admin-role-grid">
								{ALL_ROLES.map((role) => (
									<label key={role} className="admin-checkbox-label">
										<input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />
										{role}
									</label>
								))}
							</div>
						</div>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>
						{editingId ? "Update Policy" : "Create Policy"}
					</button>
				</AdminPanel>
			)}

			{showTest && (
				<AdminPanel title="Policy Tester" description="Simulate policy evaluation for a given scenario">
					<div className="admin-form-grid">
						<label>Scope<select className="topic-input" value={testInput.scope} onChange={(e) => setTestInput((t) => ({ ...t, scope: e.target.value }))}>{SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
						<label>Target<input className="topic-input" value={testInput.target} onChange={(e) => setTestInput((t) => ({ ...t, target: e.target.value }))} placeholder="e.g. bulk_export" /></label>
						<label>Role<select className="topic-input" value={testInput.role} onChange={(e) => setTestInput((t) => ({ ...t, role: e.target.value }))}>{ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
						<label>Faculty<input className="topic-input" value={testInput.faculty} onChange={(e) => setTestInput((t) => ({ ...t, faculty: e.target.value }))} placeholder="Optional" /></label>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onTest()}>Evaluate</button>
					{testResult && (
						<div className={`admin-test-result admin-test-result-${testResult.effect}`}>
							<span className={`admin-sev admin-sev-${testResult.effect === "blocked" ? "critical" : testResult.effect === "restricted" ? "high" : "low"}`}>{testResult.effect.toUpperCase()}</span>
							<span>{testResult.reason}</span>
							{testResult.matchedPolicyName && <span className="muted">Matched: {testResult.matchedPolicyName}</span>}
						</div>
					)}
				</AdminPanel>
			)}

			{conflicts.length > 0 && (
				<AdminPanel title="Policy Conflicts" description="Policies targeting the same resource with different effects">
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead><tr><th>Target</th><th>Conflicting Policies</th><th>Effects</th></tr></thead>
							<tbody>
								{conflicts.map(({ key, policies: group }) => (
									<tr key={key} className="admin-row-flagged">
										<td><code>{key}</code></td>
										<td>{group.map((p) => p.name).join(", ")}</td>
										<td>{group.map((p) => <span key={p.id} className={`admin-sev admin-sev-${p.effect === "blocked" ? "critical" : p.effect === "restricted" ? "high" : "low"}`} style={{ marginRight: 4 }}>{p.effect}</span>)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</AdminPanel>
			)}

			<div className="admin-gov-grid">
				<AdminPanel title="Filters">
					<div className="admin-form-grid">
						<label>Search<input className="topic-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, target, description…" /></label>
						<label>Scope<select className="topic-input" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}><option value="">All</option>{SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
						<label>Effect<select className="topic-input" value={effectFilter} onChange={(e) => setEffectFilter(e.target.value)}><option value="">All</option>{EFFECTS.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
					</div>
				</AdminPanel>

				<AdminPanel title="Effect Distribution">
					<div className="admin-bar-list">
						{[
							{ label: "Permitted", count: stats?.permitted ?? 0, color: "success" },
							{ label: "Restricted", count: stats?.restricted ?? 0, color: "warning" },
							{ label: "Blocked", count: stats?.blocked ?? 0, color: "danger" },
						].map((item) => (
							<div key={item.label} className="admin-bar-item">
								<span className="admin-bar-label">{item.label}</span>
								<div className="admin-bar-track">
									<div className={`admin-bar-fill admin-bar-fill-${item.color}`} style={{ width: `${(item.count / Math.max(1, stats?.total ?? 1)) * 100}%` }} />
								</div>
								<span className="admin-bar-value">{item.count}</span>
							</div>
						))}
					</div>
				</AdminPanel>
			</div>

			<AdminPanel title="Policies" description={`${filtered.length} policies · sorted by priority`}>
				{loading ? <p className="muted">Loading…</p> : (
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Name</th>
									<th>Scope</th>
									<th>Target</th>
									<th>Effect</th>
									<th>Roles</th>
									<th>Priority</th>
									<th>Enabled</th>
									<th>Created</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filtered.length === 0 ? (
									<tr><td colSpan={9} className="muted">No policies match filters.</td></tr>
								) : (
									filtered.map((p) => (
										<tr key={p.id} className={!p.enabled ? "admin-row-disabled" : undefined}>
											<td><strong>{p.name}</strong>{p.description && <p className="muted">{p.description.slice(0, 60)}</p>}</td>
											<td><code>{p.scope}</code></td>
											<td><code>{p.target}</code></td>
											<td><span className={`admin-sev admin-sev-${p.effect === "blocked" ? "critical" : p.effect === "restricted" ? "high" : "low"}`}>{p.effect}</span></td>
											<td>{p.roles.length ? p.roles.join(", ") : "All"}</td>
											<td>{p.priority}</td>
											<td><span className={`admin-chip ${p.enabled ? "admin-chip-status-active" : "admin-chip-status-inactive"}`}>{p.enabled ? "Active" : "Disabled"}</span></td>
											<td>{formatAdminDate(p.createdAt)}</td>
											<td>
												<div className="admin-row-actions">
													<button type="button" className="ghost-btn" disabled={working} onClick={() => onEdit(p)}>Edit</button>
													<button type="button" className="ghost-btn" disabled={working} onClick={() => void onToggle(p)}>{p.enabled ? "Disable" : "Enable"}</button>
													<button type="button" className="ghost-btn admin-btn-danger" disabled={working} onClick={() => void onDelete(p)}>Delete</button>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
			</AdminPanel>
		</AdminShell>
	);
}
