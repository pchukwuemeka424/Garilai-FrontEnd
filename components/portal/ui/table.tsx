import { cn } from "@/lib/portal/cn";
export function Table({ className, ...props }: React.ComponentProps<"table">) { return <div className="w-full overflow-auto"><table className={cn("w-full text-left text-sm", className)} {...props} /></div>; }
export const TableHeader = ({ className, ...props }: React.ComponentProps<"thead">) => <thead className={cn("border-b border-border text-xs uppercase tracking-wide text-foreground/50", className)} {...props} />;
export const TableBody = ({ className, ...props }: React.ComponentProps<"tbody">) => <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
export const TableRow = ({ className, ...props }: React.ComponentProps<"tr">) => <tr className={cn("border-b border-border/70 transition-colors hover:bg-muted/45", className)} {...props} />;
export const TableHead = ({ className, ...props }: React.ComponentProps<"th">) => <th className={cn("h-11 px-4 font-semibold", className)} {...props} />;
export const TableCell = ({ className, ...props }: React.ComponentProps<"td">) => <td className={cn("p-4", className)} {...props} />;
