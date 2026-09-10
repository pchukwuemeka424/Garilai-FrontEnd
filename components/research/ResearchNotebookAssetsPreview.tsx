"use client";

import type {
	NotebookBriefDatasetPreview,
	NotebookBriefImagePreview,
} from "@/lib/research-notebook-brief-html";

export function ResearchNotebookAssetsPreview({
	datasets,
	images,
	loading = false,
}: {
	datasets: NotebookBriefDatasetPreview[];
	images: NotebookBriefImagePreview[];
	loading?: boolean;
}) {
	if (loading) {
		return (
			<section className="assign-notebook-assets" aria-busy="true">
				<p className="assign-notebook-assets-state">Loading notebook datasets and images…</p>
			</section>
		);
	}

	if (!datasets.length && !images.length) return null;

	return (
		<section className="assign-notebook-assets" aria-label="Selected notebook datasets and images">
			{images.length > 0 ? (
				<div className="assign-notebook-assets-block">
					<h3 className="assign-notebook-assets-title">Images from notebook</h3>
					<ul className="assign-notebook-images">
						{images.map((image) => (
							<li key={image.id} className="assign-notebook-image-card">
								{image.src ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img src={image.src} alt={image.title} />
								) : (
									<div className="assign-notebook-image-fallback">{image.title}</div>
								)}
								<p>{image.title}</p>
							</li>
						))}
					</ul>
				</div>
			) : null}

			{datasets.length > 0 ? (
				<div className="assign-notebook-assets-block">
					<h3 className="assign-notebook-assets-title">Datasets from notebook</h3>
					{datasets.map((dataset) => (
						<div key={dataset.id} className="assign-notebook-dataset">
							<div className="assign-notebook-dataset-head">
								<strong>{dataset.title}</strong>
								{dataset.meta ? <span>{dataset.meta}</span> : null}
							</div>
							{dataset.error ? (
								<p className="assign-notebook-assets-state">{dataset.error}</p>
							) : dataset.headers.length ? (
								<div className="assign-notebook-dataset-table-wrap">
									<table>
										<thead>
											<tr>
												{dataset.headers.map((header) => (
													<th key={header}>{header}</th>
												))}
											</tr>
										</thead>
										<tbody>
											{dataset.rows.map((row, rowIndex) => (
												<tr key={`${dataset.id}-${rowIndex}`}>
													{row.map((cell, cellIndex) => (
														<td key={`${dataset.id}-${rowIndex}-${cellIndex}`}>{cell}</td>
													))}
												</tr>
											))}
										</tbody>
									</table>
									{dataset.truncated ? (
										<p className="assign-notebook-assets-state">Preview truncated for speed.</p>
									) : null}
								</div>
							) : (
								<p className="assign-notebook-assets-state">No preview rows.</p>
							)}
						</div>
					))}
				</div>
			) : null}
		</section>
	);
}
