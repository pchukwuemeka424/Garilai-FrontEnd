"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ComposedChart,
	Funnel,
	FunnelChart,
	LabelList,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	Treemap,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";

import type { GraphPlotResult } from "@/lib/research-assets-api";
import { downloadDataUrl } from "@/lib/research-assets-api";

const COLORS = ["#0D0B61", "#2563eb", "#0d9488", "#d97706", "#7c3aed", "#dc2626"];

type Props = {
	plot: GraphPlotResult;
	onSavePicture?: (dataUrl: string, fileName: string) => Promise<void> | void;
};

function safeFileName(title: string): string {
	const base = title.trim().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "chart";
	return `${base.slice(0, 60)}.png`;
}

function chartKindLabel(type: GraphPlotResult["chartType"]): string {
	return type.replace(/_/g, " ");
}

function formatAxisLabel(value: string): string {
	return value.replace(/_/g, " ").trim();
}

function formatTick(value: string | number): string {
	if (typeof value === "number" && Number.isFinite(value)) {
		return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
	}
	const text = String(value ?? "");
	return text.length > 18 ? `${text.slice(0, 16)}…` : text;
}

function formatCell(value: string | number | undefined): string {
	if (typeof value === "number" && Number.isFinite(value)) {
		return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
	}
	return String(value ?? "");
}

function AxisDataTable({ plot }: { plot: GraphPlotResult }) {
	const xKey = plot.nameKey || plot.xKey;
	const yKeys = plot.valueKey && plot.yKeys.length === 0 ? [plot.valueKey] : plot.yKeys;
	const rows = plot.series.slice(0, 40);
	if (!xKey || rows.length === 0) return null;

	return (
		<section className="nb-axis-data" aria-label="X and Y axis data">
			<div className="nb-axis-map">
				<p>
					<strong>X axis</strong>
					<span>{formatAxisLabel(xKey)}</span>
				</p>
				<p>
					<strong>Y axis</strong>
					<span>{yKeys.map(formatAxisLabel).join(", ") || "—"}</span>
				</p>
			</div>
			<div className="nb-axis-table-wrap">
				<table>
					<caption>Data plotted on X and Y</caption>
					<thead>
						<tr>
							<th scope="col">X · {formatAxisLabel(xKey)}</th>
							{yKeys.map((key) => (
								<th key={key} scope="col">
									Y · {formatAxisLabel(key)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, i) => (
							<tr key={`${String(row[xKey])}-${i}`}>
								<td>{formatCell(row[xKey])}</td>
								{yKeys.map((key) => (
									<td key={key}>{formatCell(row[key])}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{plot.series.length > rows.length ? (
				<p className="nb-axis-more">Showing {rows.length} of {plot.series.length} plotted points.</p>
			) : null}
		</section>
	);
}

function PlotChart({
	plot,
	width,
	height,
}: {
	plot: GraphPlotResult;
	width?: number;
	height?: number;
}) {
	const data = plot.series;
	const w = width && width > 10 ? width : 640;
	const h = height && height > 10 ? height : 320;
	const nameKey = plot.nameKey || plot.xKey;
	const valueKey = plot.valueKey || plot.yKeys[0];
	const xLabel = formatAxisLabel(plot.xKey || "X");
	const yLabel = formatAxisLabel((plot.yKeys.length ? plot.yKeys.join(", ") : plot.valueKey) || "Y");
	const margin = { top: 16, right: 20, bottom: 68, left: 64 };
	const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />;
	const xAxisLabel = {
		value: `X: ${xLabel}`,
		position: "insideBottom" as const,
		offset: -18,
		style: { fill: "#334155", fontSize: 12, fontWeight: 600 },
	};
	const yAxisLabel = {
		value: `Y: ${yLabel}`,
		angle: -90,
		position: "insideLeft" as const,
		offset: 4,
		style: { fill: "#334155", fontSize: 12, fontWeight: 600, textAnchor: "middle" },
	};
	const xTicks = {
		interval: (data.length <= 24 ? 0 : "preserveStartEnd") as 0 | "preserveStartEnd",
		angle: data.length > 8 ? -32 : 0,
		textAnchor: data.length > 8 ? ("end" as const) : ("middle" as const),
		height: data.length > 8 ? 72 : 52,
		tickFormatter: formatTick,
		tick: { fontSize: 11, fill: "#334155" },
	};
	const axes = (
		<>
			<XAxis dataKey={plot.xKey} {...xTicks} label={xAxisLabel} />
			<YAxis tick={{ fontSize: 11, fill: "#334155" }} width={72} tickFormatter={formatTick} label={yAxisLabel} />
		</>
	);

	switch (plot.chartType) {
		case "pie":
		case "doughnut":
			return (
				<PieChart width={w} height={h}>
					<Pie
						data={data}
						dataKey={valueKey}
						nameKey={nameKey}
						cx="50%"
						cy="50%"
						innerRadius={plot.chartType === "doughnut" ? 58 : 0}
						outerRadius={Math.min(110, h / 2 - 24)}
						label
					>
						{data.map((_, i) => (
							<Cell key={i} fill={COLORS[i % COLORS.length]} />
						))}
					</Pie>
					<Tooltip />
					<Legend />
				</PieChart>
			);
		case "funnel":
			return (
				<FunnelChart width={w} height={h}>
					<Tooltip />
					<Funnel data={data} dataKey={valueKey} nameKey={nameKey} isAnimationActive={false}>
						{data.map((_, i) => (
							<Cell key={i} fill={COLORS[i % COLORS.length]} />
						))}
						<LabelList position="right" fill="#334155" stroke="none" dataKey={nameKey} />
					</Funnel>
				</FunnelChart>
			);
		case "treemap":
			return (
				<Treemap
					width={w}
					height={h}
					data={data.map((row) => ({
						name: String(row[nameKey] ?? ""),
						size: Number(row[valueKey] ?? 0),
					}))}
					dataKey="size"
					nameKey="name"
					stroke="#fff"
					aspectRatio={4 / 3}
				>
					<Tooltip />
				</Treemap>
			);
		case "radar":
			return (
				<RadarChart width={w} height={h} data={data} cx="50%" cy="50%" outerRadius="70%">
					<PolarGrid />
					<PolarAngleAxis dataKey={plot.xKey} tick={{ fontSize: 11 }} />
					<PolarRadiusAxis />
					<Tooltip />
					<Legend />
					{plot.yKeys.map((key, i) => (
						<Radar key={key} name={key} dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} />
					))}
				</RadarChart>
			);
		case "scatter":
		case "bubble":
			return (
				<ScatterChart width={w} height={h} margin={margin}>
					{grid}
					<XAxis dataKey={plot.xKey} name={xLabel} {...xTicks} label={xAxisLabel} />
					<YAxis dataKey={plot.yKeys[0]} name={yLabel} tick={{ fontSize: 11, fill: "#334155" }} width={72} tickFormatter={formatTick} label={yAxisLabel} />
					{plot.chartType === "bubble" && plot.yKeys[1] ? (
						<ZAxis dataKey={plot.yKeys[1]} range={[40, 280]} name={plot.yKeys[1]} />
					) : null}
					<Tooltip />
					<Scatter data={data} fill={COLORS[0]} />
				</ScatterChart>
			);
		case "line":
			return (
				<LineChart width={w} height={h} data={data} margin={margin}>
					{grid}
					{axes}
					<Tooltip />
					<Legend />
					{plot.yKeys.map((key, i) => (
						<Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
					))}
				</LineChart>
			);
		case "area":
			return (
				<AreaChart width={w} height={h} data={data} margin={margin}>
					{grid}
					{axes}
					<Tooltip />
					<Legend />
					{plot.yKeys.map((key, i) => (
						<Area key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.18} />
					))}
				</AreaChart>
			);
		case "composed":
			return (
				<ComposedChart width={w} height={h} data={data} margin={margin}>
					{grid}
					{axes}
					<Tooltip />
					<Legend />
					<Bar dataKey={plot.yKeys[0]} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
					{plot.yKeys.slice(1).map((key, i) => (
						<Line key={key} type="monotone" dataKey={key} stroke={COLORS[(i + 1) % COLORS.length]} strokeWidth={2} />
					))}
				</ComposedChart>
			);
		case "horizontal_bar":
			return (
				<BarChart width={w} height={h} data={data} layout="vertical" margin={{ top: 12, right: 28, bottom: 56, left: 96 }}>
					{grid}
					<XAxis type="number" tick={{ fontSize: 11, fill: "#334155" }} tickFormatter={formatTick} height={52} label={{ ...xAxisLabel, value: `X: ${yLabel}` }} />
					<YAxis type="category" dataKey={plot.xKey} width={118} tick={{ fontSize: 11, fill: "#334155" }} tickFormatter={formatTick} interval={0} label={{ ...yAxisLabel, value: `Y: ${xLabel}` }} />
					<Tooltip />
					<Legend />
					{plot.yKeys.map((key, i) => (
						<Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
					))}
				</BarChart>
			);
		case "stacked_bar":
			return (
				<BarChart width={w} height={h} data={data} margin={margin}>
					{grid}
					{axes}
					<Tooltip />
					<Legend />
					{plot.yKeys.map((key, i) => (
						<Bar key={key} dataKey={key} stackId="stack" fill={COLORS[i % COLORS.length]} />
					))}
				</BarChart>
			);
		case "histogram":
		case "bar":
		default:
			return (
				<BarChart width={w} height={h} data={data} margin={margin}>
					{grid}
					{axes}
					<Tooltip />
					<Legend />
					{plot.yKeys.map((key, i) => (
						<Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]}>
							{i === 0 ? <LabelList dataKey={key} position="top" formatter={formatTick} style={{ fontSize: 10, fill: "#475569" }} /> : null}
						</Bar>
					))}
				</BarChart>
			);
	}
}

export function NotebookPlot({ plot, onSavePicture }: Props) {
	const figureRef = useRef<HTMLElement>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState("");

	async function saveAsPicture() {
		const node = figureRef.current;
		if (!node) return;
		setSaving(true);
		setSaveError("");
		try {
			const canvas = await html2canvas(node, {
				backgroundColor: "#ffffff",
				scale: 2,
				useCORS: true,
			});
			const dataUrl = canvas.toDataURL("image/png");
			const fileName = safeFileName(plot.title);
			downloadDataUrl(dataUrl, fileName);
			await onSavePicture?.(dataUrl, fileName);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Could not save picture.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<article className="nb-figure">
			<header className="nb-figure-bar">
				<div>
					<p className="nb-figure-kicker">{chartKindLabel(plot.chartType)} chart</p>
					<h3>{plot.title}</h3>
				</div>
				<button type="button" className="nb-figure-save" onClick={() => void saveAsPicture()} disabled={saving}>
					{saving ? "Saving…" : "Save as picture"}
				</button>
			</header>
			{saveError ? <p className="nb-error">{saveError}</p> : null}
			<figure className="nb-plot" ref={figureRef}>
				<figcaption>{plot.title}</figcaption>
				<div className="nb-plot-canvas">
					{plot.series.length === 0 ? (
						<p className="nb-plot-missing">No points to plot for this mapping.</p>
					) : (
						<ResponsiveContainer width="100%" height={360}>
							<PlotChart plot={plot} />
						</ResponsiveContainer>
					)}
				</div>
			</figure>
			<AxisDataTable plot={plot} />
			<div className="nb-data-chat" aria-label="AI plot chat">
				{plot.userPrompt ? (
					<div className="nb-data-msg nb-data-msg-user">
						<span>You</span>
						<p>{plot.userPrompt}</p>
					</div>
				) : null}
				<div className="nb-data-msg nb-data-msg-ai">
					<span>AI</span>
					{plot.explanation.summary ? <p>{plot.explanation.summary}</p> : <p>Plotted {plot.yKeys.join(", ")} by {plot.xKey}.</p>}
					{plot.explanation.insights.length > 0 && (
						<ul>
							{plot.explanation.insights.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					)}
					{plot.explanation.caveats ? <p className="nb-plot-caveat">{plot.explanation.caveats}</p> : null}
				</div>
			</div>
			<p className="nb-figure-meta">
				{plot.rowCount.toLocaleString()} rows · {plot.datasetTitle}
			</p>
		</article>
	);
}
